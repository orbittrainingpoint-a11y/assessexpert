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

  async getSessionState(token: string) {
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

    const answeredCount = await this.prisma.examAnswer.count({ where: { sessionId: session.id } });
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

  async getCurrentQuestion(token: string) {
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

    return this.questionsService.getCurrentQuestion(session.id);
  }

  async submitAnswer(token: string, questionId: string, response: any, timeSpentSeconds: number) {
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'MCQ_IN_PROGRESS') {
      throw new BadRequestException('Exam is not in MCQ phase');
    }

    const result = await this.questionsService.submitAnswer(session.id, questionId, response, timeSpentSeconds);

    // Emit real-time progress update to proctor
    this.gateway.emitToSession(session.id, 'candidate.progress', {
      sessionId: session.id,
      candidateId: session.candidateId,
      questionProgress: result.answeredCount,
      totalQuestions: 25,
      isCorrect: result.isCorrect,
      isComplete: result.isComplete,
    });

    if (result.isComplete) {
      await this.sessionsService.completeMcq(session.id);
      this.gateway.emitToSession(session.id, 'exam.mcqSubmitted', {
        sessionId: session.id,
        candidateId: session.candidateId,
      });
    }

    return result;
  }

  async autoSubmitMcq(sessionId: string) {
    // Auto-submit any unanswered questions
    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({ where: { sessionId } });
    if (!assignment) return;

    const answeredCount = await this.prisma.examAnswer.count({ where: { sessionId } });
    const order = assignment.questionOrder as any[];

    for (let i = answeredCount; i < 25; i++) {
      const item = order[i];
      const question = await this.prisma.question.findUnique({ where: { id: item.questionId } });
      if (question) {
        await this.prisma.examAnswer.create({
          data: {
            sessionId,
            questionId: item.questionId,
            position: item.position,
            questionSnapshot: { content: question.content, options: question.options, type: question.type },
            candidateResponse: null,
            isCorrect: false,
            correctAnswer: question.correctAnswer,
            timeSpentSeconds: 0,
            marks: 0,
            maxMarks: question.marks,
          },
        });
      }
    }

    await this.sessionsService.completeMcq(sessionId);
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
