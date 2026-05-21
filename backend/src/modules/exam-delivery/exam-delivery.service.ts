import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { SessionsService } from '../sessions/sessions.service';
import { AppGateway } from '../gateway/app.gateway';

@Injectable()
export class ExamDeliveryService {
  private readonly logger = new Logger(ExamDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private questionsService: QuestionsService,
    private sessionsService: SessionsService,
    private gateway: AppGateway,
  ) {}

  // Sweep every minute and auto-submit any candidate whose MCQ or
  // practical timer has expired. Without this, a candidate who closes
  // their tab after the timer ran out left the session pinned in
  // MCQ_IN_PROGRESS / PRACTICAL_IN_PROGRESS forever — the proctor had
  // to manually terminate. The sweep is idempotent: candidates already
  // in a terminal status are skipped.
  @Cron('* * * * *')
  async sweepExpiredExams() {
    const now = Date.now();
    // Pull a small batch of in-progress sessions (cap at 200) and check
    // their per-candidate timer against the configured limit. The cap
    // protects the worker if a backlog builds up after a restart.
    const inProgress = await this.prisma.examSession.findMany({
      where: { status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'] } },
      include: {
        assessmentType: { select: { mcqTimeLimit: true, practicalTimeLimit: true } },
        sessionCandidates: { select: { candidateId: true, status: true, mcqSubmittedAt: true, practicalSubmittedAt: true } },
      },
      take: 200,
    });

    for (const s of inProgress) {
      try {
        if (s.status === 'MCQ_IN_PROGRESS' && s.mcqStartedAt && s.assessmentType?.mcqTimeLimit) {
          const limitMs = s.assessmentType.mcqTimeLimit * 60 * 1000;
          const expired = now - s.mcqStartedAt.getTime() > limitMs;
          if (!expired) continue;
          // Every candidate not already submitted gets auto-submitted.
          const expected = new Set<string>([s.candidateId]);
          s.sessionCandidates.forEach(sc => expected.add(sc.candidateId));
          for (const cId of expected) {
            const sc = s.sessionCandidates.find(r => r.candidateId === cId);
            const alreadyDone = sc && ['MCQ_SUBMITTED', 'PRACTICAL_IN_PROGRESS', 'PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED'].includes(sc.status as any);
            if (alreadyDone) continue;
            await this.autoSubmitMcq(s.id, cId);
            this.gateway.emitToSession(s.id, 'exam.mcqAutoSubmitted', { sessionId: s.id, candidateId: cId, reason: 'timer_expired' });
          }
        } else if (s.status === 'PRACTICAL_IN_PROGRESS' && s.practicalStartedAt && s.assessmentType?.practicalTimeLimit) {
          const limitMs = s.assessmentType.practicalTimeLimit * 60 * 1000;
          const expired = now - s.practicalStartedAt.getTime() > limitMs;
          if (!expired) continue;
          const expected = new Set<string>([s.candidateId]);
          s.sessionCandidates.forEach(sc => expected.add(sc.candidateId));
          for (const cId of expected) {
            const sc = s.sessionCandidates.find(r => r.candidateId === cId);
            const alreadyDone = sc && ['PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED'].includes(sc.status as any);
            if (alreadyDone) continue;
            await this.autoSubmitPractical(s.id, cId);
            this.gateway.emitToSession(s.id, 'exam.practicalAutoSubmitted', { sessionId: s.id, candidateId: cId, reason: 'timer_expired' });
          }
        }
      } catch (e: any) {
        this.logger.warn(`Sweep failed for session ${s.id}: ${e?.message || e}`);
      }
    }
  }

  async getPracticalTask(token: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { practicalTask: true, assessmentType: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Multi-candidate slots: prefer the candidate's own task on
    // SessionCandidate. Falls back to the session-level task if no
    // per-candidate override exists.
    let task = session.practicalTask;
    if (session.isMultiCandidate || candidateId) {
      const cId = candidateId || session.candidateId;
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId: session.id, candidateId: cId } },
        include: { practicalTask: true },
      });
      if (sc?.practicalTask) task = sc.practicalTask;
    }
    if (!task) throw new NotFoundException('No practical task assigned yet');

    return {
      title: task.title,
      description: task.description,
      acceptedFileTypes: task.acceptedFileTypes,
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

    // Resolve per-candidate practical assignment. Multi-candidate slots
    // (and any single-candidate caller passing candidateId) prefer the
    // SessionCandidate row so different candidates can get different
    // sets/tasks. Falls back to session-level columns.
    let resolvedTask: any = session.practicalTask;
    let resolvedPaperSet: any = session.practicalPaperSet;
    let resolvedPaperSetId: string | null = session.practicalPaperSetId;
    if (session.isMultiCandidate || candidateId) {
      const cId = candidateId || session.candidateId;
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId: session.id, candidateId: cId } },
        include: { practicalTask: true, practicalPaperSet: true },
      });
      if (sc?.practicalTask) resolvedTask = sc.practicalTask;
      if (sc?.practicalPaperSet) {
        resolvedPaperSet = sc.practicalPaperSet;
        resolvedPaperSetId = sc.practicalPaperSetId;
      }
    }

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
      practicalTask: resolvedTask ? {
        title: resolvedTask.title,
        description: resolvedTask.description,
        acceptedFileTypes: resolvedTask.acceptedFileTypes,
      } : null,
      practicalPaperSetId: resolvedPaperSetId,
      practicalPaperSet: resolvedPaperSet ? {
        id: resolvedPaperSet.id,
        name: resolvedPaperSet.name,
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
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: { select: { mcqTimeLimit: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'MCQ_IN_PROGRESS') {
      throw new BadRequestException('Exam is not in MCQ phase');
    }

    const cId = await this.resolveCandidateId(session.id, candidateId);

    // Session-wide MCQ timer (every candidate in the slot shares the
    // same countdown — started when the proctor pushed MCQ). Compared
    // against the per-assessment configured limit. Previously this used
    // a hardcoded 30 minutes that ignored the AssessmentType.mcqTimeLimit
    // value, so a customer who configured a 60-minute exam was being
    // force-submitted at 30. Fixed.
    if (session.mcqStartedAt && session.assessmentType?.mcqTimeLimit) {
      const elapsed = (Date.now() - session.mcqStartedAt.getTime()) / 1000;
      const limit = session.assessmentType.mcqTimeLimit * 60;
      if (elapsed > limit) {
        await this.autoSubmitMcq(session.id, cId);
        throw new BadRequestException('MCQ time has expired');
      }
    }
    await this.assertCandidateNotAlreadySubmitted(session, cId);

    return this.questionsService.getCurrentQuestion(session.id, cId);
  }

  // Guards multi-candidate slots: even though session.status remains
  // MCQ_IN_PROGRESS for the whole group, an individual candidate who has
  // already submitted must not be able to fetch or submit more questions.
  private async assertCandidateNotAlreadySubmitted(
    session: { id: string; isMultiCandidate: boolean },
    candidateId: string,
  ) {
    if (!session.isMultiCandidate) return;
    const sc = await this.prisma.sessionCandidate.findUnique({
      where: { sessionId_candidateId: { sessionId: session.id, candidateId } },
      select: { status: true },
    });
    const terminal = new Set([
      'MCQ_SUBMITTED', 'PRACTICAL_IN_PROGRESS', 'PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED',
    ]);
    if (sc && terminal.has(sc.status as any)) {
      throw new BadRequestException('You have already submitted your MCQ answers');
    }
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
    await this.assertCandidateNotAlreadySubmitted(session, cId);
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
      // Per-candidate finish — only flips session.status when EVERY
      // candidate in the slot has finished (multi-candidate), or
      // straight to MCQ_COMPLETE for single-candidate sessions.
      await this.sessionsService.completeMcq(session.id, cId);
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

    // completeMcq is now candidate-aware: for multi-candidate slots it
    // only flips session.status when EVERY candidate has finished, so
    // we can always call it after auto-submitting one candidate.
    await this.sessionsService.completeMcq(sessionId, cId);
  }

  // Called by the candidate's browser the moment its countdown reaches
  // zero. We re-verify the timer against session.mcqStartedAt /
  // practicalStartedAt + the configured limit — a candidate whose
  // clock is fast (or who manipulated the JS countdown) can't trick us
  // into auto-submitting early.
  async handleClientTimerExpired(token: string, phase: 'mcq' | 'practical', candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: { select: { mcqTimeLimit: true, practicalTimeLimit: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    const cId = candidateId || session.candidateId;
    const now = Date.now();

    if (phase === 'mcq') {
      if (session.status !== 'MCQ_IN_PROGRESS' || !session.mcqStartedAt || !session.assessmentType?.mcqTimeLimit) {
        return { autoSubmitted: false, reason: 'not_in_mcq_phase' };
      }
      const limitMs = session.assessmentType.mcqTimeLimit * 60 * 1000;
      if (now - session.mcqStartedAt.getTime() < limitMs) {
        return { autoSubmitted: false, reason: 'timer_not_expired' };
      }
      await this.autoSubmitMcq(session.id, cId);
      this.gateway.emitToSession(session.id, 'exam.mcqAutoSubmitted', { sessionId: session.id, candidateId: cId, reason: 'client_timer_expired' });
      return { autoSubmitted: true };
    }

    if (phase === 'practical') {
      if (session.status !== 'PRACTICAL_IN_PROGRESS' || !session.practicalStartedAt || !session.assessmentType?.practicalTimeLimit) {
        return { autoSubmitted: false, reason: 'not_in_practical_phase' };
      }
      const limitMs = session.assessmentType.practicalTimeLimit * 60 * 1000;
      if (now - session.practicalStartedAt.getTime() < limitMs) {
        return { autoSubmitted: false, reason: 'timer_not_expired' };
      }
      await this.autoSubmitPractical(session.id, cId);
      this.gateway.emitToSession(session.id, 'exam.practicalAutoSubmitted', { sessionId: session.id, candidateId: cId, reason: 'client_timer_expired' });
      return { autoSubmitted: true };
    }

    return { autoSubmitted: false, reason: 'unknown_phase' };
  }

  // Auto-submit the practical phase for a candidate whose timer expired.
  // Unlike MCQs there's no "blank answer for question N" semantic — the
  // practical is one open submission per candidate. We mark the
  // SessionCandidate as PRACTICAL_SUBMITTED with practicalSubmittedAt=now
  // and let the proctor review whatever (if any) artifacts were uploaded
  // before the timer ran out.
  async autoSubmitPractical(sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, isMultiCandidate: true, status: true },
    });
    if (!session) return;
    if (session.status !== 'PRACTICAL_IN_PROGRESS') return;
    const cId = candidateId || session.candidateId;

    // Flip THIS candidate to PRACTICAL_SUBMITTED. The session-wide
    // submitPractical method (sessionsService) handles aggregating
    // "every candidate is done" → session.status=SUBMITTED.
    return this.sessionsService.submitPractical(sessionId, undefined, undefined, cId);
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
