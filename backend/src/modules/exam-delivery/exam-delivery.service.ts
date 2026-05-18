import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { SessionsService } from '../sessions/sessions.service';
import { AppGateway } from '../gateway/app.gateway';

@Injectable()
export class ExamDeliveryService {
  constructor(
    private prisma: PrismaService,
    private questionsService: QuestionsService,
    private sessionsService: SessionsService,
    private gateway: AppGateway,
  ) {}

  async getPracticalTask(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { practicalTask: true, assessmentType: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.practicalTask) throw new NotFoundException('No practical task assigned yet');
    return {
      title: session.practicalTask.title,
      description: session.practicalTask.description,
      acceptedFileTypes: session.practicalTask.acceptedFileTypes,
      estimatedMinutes: session.assessmentType.practicalTimeLimit,
    };
  }

  async getSessionByToken(token: string) {
    return this.prisma.examSession.findUnique({ where: { magicToken: token } });
  }

  async getSessionState(token: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: true, candidate: true, practicalTask: true, practicalPaperSet: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Check if candidate is joining within the allowed time window (15 minutes before to 15 minutes after)
    const now = new Date();
    const scheduledTime = new Date(session.scheduledAt);
    const fifteenMinutesBefore = new Date(scheduledTime.getTime() - 15 * 60 * 1000);
    const fifteenMinutesAfter = new Date(scheduledTime.getTime() + 15 * 60 * 1000);

    if (session.status === 'SCHEDULED' && (now < fifteenMinutesBefore || now > fifteenMinutesAfter)) {
      throw new BadRequestException(
        `This session can only be accessed between ${fifteenMinutesBefore.toLocaleTimeString()} and ${fifteenMinutesAfter.toLocaleTimeString()}. Current time: ${now.toLocaleTimeString()}`
      );
    }

    // The candidate's own progress only. Multi-candidate slots have separate
    // answer buckets per candidate, so we filter on the OTP-resolved id.
    const myCandidateId = candidateId || session.candidateId;
    const answeredCount = await this.prisma.examAnswer.count({
      where: { sessionId: session.id, candidateId: myCandidateId },
    });
    const mcqTimeRemaining = session.mcqStartedAt
      ? Math.max(0, session.assessmentType.mcqTimeLimit * 60 - Math.floor((Date.now() - session.mcqStartedAt.getTime()) / 1000))
      : null;
    const practicalTimeRemaining = session.practicalStartedAt
      ? Math.max(0, session.assessmentType.practicalTimeLimit * 60 - Math.floor((Date.now() - session.practicalStartedAt.getTime()) / 1000))
      : null;

    return {
      sessionId: session.id,
      id: session.id,
      status: session.status,
      assessmentType: session.assessmentType.name,
      assessmentTypeFull: session.assessmentType,
      candidateName: `${session.candidate.firstName} ${session.candidate.lastName}`,
      scheduledAt: session.scheduledAt,
      mcqTimeRemaining,
      practicalTimeRemaining,
      answeredCount,
      totalQuestions: session.assessmentType.mcqQuestionCount,
      practicalTask: session.practicalTask ? {
        title: session.practicalTask.title,
        description: session.practicalTask.description,
        acceptedFileTypes: session.practicalTask.acceptedFileTypes,
      } : null,
      practicalPaperSetId: session.practicalPaperSetId,
      practicalPaperSet: session.practicalPaperSet ? {
        id: session.practicalPaperSet.id,
        name: session.practicalPaperSet.name,
      } : null,
    };
  }

  // Resolve which candidate this magic-token request represents. For
  // single-candidate sessions, falls back to the session's primary
  // candidate so callers that don't (yet) pass candidateId still work.
  // For multi-candidate slots, the candidateId MUST be provided after OTP.
  private async resolveCandidateId(sessionId: string, candidateId?: string): Promise<string> {
    if (candidateId) return candidateId;
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, isMultiCandidate: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.isMultiCandidate && !candidateId) {
      throw new BadRequestException('candidateId is required for multi-candidate sessions');
    }
    return session.candidateId;
  }

  async getCurrentQuestion(token: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'MCQ_IN_PROGRESS') {
      throw new BadRequestException('Exam is not in MCQ phase');
    }

    // Check timer
    if (session.mcqStartedAt) {
      const elapsed = (Date.now() - session.mcqStartedAt.getTime()) / 1000;
      const limit = 30 * 60; // 30 minutes
      if (elapsed > limit) {
        await this.autoSubmitMcq(session.id);
        throw new BadRequestException('MCQ time has expired');
      }
    }

    const cId = await this.resolveCandidateId(session.id, candidateId);
    return this.questionsService.getCurrentQuestion(session.id, cId);
  }

  async submitAnswer(
    token: string,
    questionId: string,
    response: any,
    timeSpentSeconds: number,
    candidateId?: string,
  ) {
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'MCQ_IN_PROGRESS') {
      throw new BadRequestException('Exam is not in MCQ phase');
    }

    const cId = await this.resolveCandidateId(session.id, candidateId);
    const result = await this.questionsService.submitAnswer(session.id, questionId, response, timeSpentSeconds, cId);

    this.gateway.emitToSession(session.id, 'candidate.progress', {
      sessionId: session.id,
      candidateId: cId,
      questionProgress: result.answeredCount,
      totalQuestions: 25,
      isCorrect: result.isCorrect,
      isComplete: result.isComplete,
    });

    if (result.isComplete) {
      await this.sessionsService.completeMcq(session.id);
      // Score for THIS candidate only — multi-candidate slots no longer
      // share an answer bucket so the per-candidate correctCount is real.
      const correctCount = await this.prisma.examAnswer.count({
        where: { sessionId: session.id, candidateId: cId, isCorrect: true },
      });
      this.gateway.emitToSession(session.id, 'exam.mcqSubmitted', {
        sessionId: session.id,
        candidateId: cId,
        score: correctCount,
        total: 25,
      });
    }

    return result;
  }

  // Auto-submit unanswered questions for a single candidate when their
  // MCQ timer expires. Each candidate in a multi-candidate slot finishes
  // independently, so we never auto-submit on behalf of others.
  async autoSubmitMcq(sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, isMultiCandidate: true },
    });
    if (!session) return;
    const cId = candidateId || session.candidateId;

    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!assignment) return;

    const answeredCount = await this.prisma.examAnswer.count({
      where: { sessionId, candidateId: cId },
    });
    const order = assignment.questionOrder as any[];

    for (let i = answeredCount; i < 25; i++) {
      const item = order[i];
      const question = await this.prisma.question.findUnique({ where: { id: item.questionId } });
      if (question) {
        await this.prisma.examAnswer.create({
          data: {
            sessionId,
            candidateId: cId,
            questionId: item.questionId,
            position: item.position,
            questionSnapshot: { content: question.content, options: question.options, type: question.type },
            candidateResponse: null as any,
            isCorrect: false,
            correctAnswer: question.correctAnswer,
            timeSpentSeconds: 0,
            marks: 0,
            maxMarks: question.marks,
          },
        });
      }
    }

    // For single-candidate sessions, also flip the session status. For
    // multi-candidate, the SessionsService handles the aggregate transition
    // when every SessionCandidate has finished.
    if (!session.isMultiCandidate) {
      await this.sessionsService.completeMcq(sessionId);
    }
  }

  async submitPractical(token: string, filePath?: string, fileName?: string) {
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'PRACTICAL_IN_PROGRESS') {
      throw new BadRequestException('Exam is not in practical phase');
    }
    return this.sessionsService.submitPractical(session.id, filePath, fileName);
  }

  async getTimer(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const now = Date.now();
    let remaining = 0;
    let phase = session.status;

    if (session.status === 'MCQ_IN_PROGRESS' && session.mcqStartedAt) {
      remaining = Math.max(0, session.assessmentType.mcqTimeLimit * 60 - Math.floor((now - session.mcqStartedAt.getTime()) / 1000));
    } else if (session.status === 'PRACTICAL_IN_PROGRESS' && session.practicalStartedAt) {
      remaining = Math.max(0, session.assessmentType.practicalTimeLimit * 60 - Math.floor((now - session.practicalStartedAt.getTime()) / 1000));
    }

    return { phase, remaining, serverTime: now };
  }
}
