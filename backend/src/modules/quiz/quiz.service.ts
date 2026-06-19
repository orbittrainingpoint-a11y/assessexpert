import { Injectable, Logger, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Quiz module — MCQ-only assessment flow without camera/proctor.
 *
 * Lifecycle:
 *   HR schedules quiz → SCHEDULED + magicToken + (optional OTP later)
 *   Candidate clicks magic link → /quiz/<token>
 *   Candidate requests OTP → POST /quiz/public/<token>/send-otp
 *   Candidate enters OTP    → POST /quiz/public/<token>/verify-otp
 *   Candidate sees instructions, then MCQ list
 *   Candidate submits        → POST /quiz/public/<token>/submit
 *   Backend scores + auto-publishes a Report
 *   Candidate sees "Thank you" + summary card
 *   HR sees the report under /hr/quiz-reports
 */
@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Token / OTP ─────────────────────────────────────────────────────────

  /** Public lookup — validates token + returns the minimum candidate needs. */
  async getByToken(token: string) {
    if (!token) throw new BadRequestException('token is required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true } },
        assessmentType: { select: { name: true, description: true, mcqTimeLimit: true, mcqQuestionCount: true } },
        organization: { select: { id: true, name: true, tradingName: true, logo: true, brandingConfig: true } },
      },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') {
      throw new BadRequestException('This link is for a proctored exam, not a quiz.');
    }
    if (session.tokenExpiresAt < new Date()) throw new BadRequestException('Quiz link has expired');
    if (['COMPLETED', 'SUBMITTED', 'CANCELLED', 'TERMINATED'].includes(session.status)) {
      // Return the row but flag the status so the UI can show "already submitted".
      return this.publicShape(session);
    }
    return this.publicShape(session);
  }

  private publicShape(s: any) {
    return {
      id: s.id,
      status: s.status,
      mode: s.mode,
      scheduledAt: s.scheduledAt,
      candidate: {
        firstName: s.candidate?.firstName,
        lastName: s.candidate?.lastName,
        // Mask the email so a shared link can't be used to harvest the
        // candidate's address — show first letter + domain only.
        emailMask: maskEmail(s.candidate?.email),
      },
      assessmentType: {
        name: s.assessmentType?.name,
        description: s.assessmentType?.description,
        durationMinutes: s.assessmentType?.mcqTimeLimit,
        questionCount: s.assessmentType?.mcqQuestionCount,
      },
      organization: {
        id: s.organization?.id,
        displayName: s.organization?.tradingName || s.organization?.name,
        logoUrl: s.organization?.logo || null,
        brandColor: (s.organization?.brandingConfig as any)?.brandColor || null,
      },
    };
  }

  /** Generate a 6-digit OTP, store its hash, email it to the candidate. */
  async sendOtp(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { candidate: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');

    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const otpHash = createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: { quizOtpHash: otpHash, quizOtpExpiresAt: otpExpiresAt },
    });

    try {
      await this.notifications.sendEmail(
        session.candidate.email,
        `Your quiz access code: ${otp}`,
        `<div style="font-family:Inter,sans-serif;padding:24px;color:#0f172a">
          <h2 style="margin:0 0 8px">Your access code</h2>
          <p style="margin:0 0 12px;color:#475569">Enter this 6-digit code on the quiz page to begin.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:14px;background:#f1f5f9;border-radius:8px;text-align:center;color:#0f172a">${otp}</div>
          <p style="margin:14px 0 0;font-size:12px;color:#64748b">Valid for 10 minutes. Do not share this code with anyone.</p>
        </div>`,
      );
    } catch (e: any) {
      this.logger.error(`Quiz OTP email failed: ${e?.message || e}`);
    }

    return { sent: true, expiresAt: otpExpiresAt };
  }

  /** Verify OTP; on success, return the question payload. */
  async verifyOtp(token: string, otp: string) {
    if (!otp || !/^\d{6}$/.test(otp)) throw new BadRequestException('Enter the 6-digit code');
    const session = await this.prisma.examSession.findUnique({ where: { magicToken: token } });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    if (!session.quizOtpHash || !session.quizOtpExpiresAt) {
      throw new BadRequestException('Request an access code first');
    }
    if (session.quizOtpExpiresAt < new Date()) throw new BadRequestException('Access code expired');
    const provided = createHash('sha256').update(otp).digest('hex');
    if (provided !== session.quizOtpHash) throw new UnauthorizedException('Invalid access code');

    // Clear OTP so it can't be re-used; mark token used.
    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        quizOtpHash: null,
        quizOtpExpiresAt: null,
        tokenUsedAt: session.tokenUsedAt || new Date(),
      },
    });
    return { verified: true };
  }

  // ── Quiz flow ───────────────────────────────────────────────────────────

  /** Returns the questions for this quiz. Marks the session IN_PROGRESS. */
  async getQuestions(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: { select: { id: true, mcqQuestionCount: true, mcqTimeLimit: true } } },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    if (['COMPLETED', 'SUBMITTED', 'CANCELLED', 'TERMINATED'].includes(session.status)) {
      throw new BadRequestException('Quiz already submitted');
    }

    // First call → flip to MCQ_IN_PROGRESS.
    if (session.status !== 'MCQ_IN_PROGRESS') {
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'MCQ_IN_PROGRESS' as any, mcqStartedAt: new Date() },
      });
    }

    const target = session.assessmentType.mcqQuestionCount || 20;
    const all = await this.prisma.question.findMany({
      where: { assessmentTypeId: session.assessmentType.id },
      select: { id: true, type: true, content: true, options: true, domain: true, difficulty: true },
    });
    // Shuffle + take target count
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, target);

    return {
      durationMinutes: session.assessmentType.mcqTimeLimit || 30,
      startedAt: session.mcqStartedAt || new Date(),
      questions: shuffled.map((q, i) => ({
        position: i + 1,
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        domain: q.domain,
      })),
    };
  }

  /**
   * Submit all answers. Each answer is graded against the question's
   * stored correctAnswer; a report is generated atomically.
   */
  async submit(token: string, body: { answers: Array<{ questionId: string; selected: string[]; timeSpentSeconds?: number }> }) {
    if (!Array.isArray(body?.answers)) throw new BadRequestException('answers array required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { assessmentType: true },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    if (['COMPLETED', 'SUBMITTED', 'CANCELLED', 'TERMINATED'].includes(session.status)) {
      throw new BadRequestException('Quiz already submitted');
    }

    // Pull every referenced question in one query for grading.
    const ids = body.answers.map(a => a.questionId).filter(Boolean);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(questions.map(q => [q.id, q]));

    // Build the ExamAnswer rows + accumulate per-domain stats.
    const domainStats: Record<string, { correct: number; total: number; score: number; maxScore: number }> = {};
    let totalScore = 0;
    let maxTotal = 0;
    const answerRows: any[] = [];

    for (let i = 0; i < body.answers.length; i++) {
      const a = body.answers[i];
      const q = byId.get(a.questionId);
      if (!q) continue;

      const correctSet = new Set((q.correctAnswer as any[]) || []);
      const providedSet = new Set(a.selected || []);
      const isCorrect = correctSet.size === providedSet.size &&
        [...correctSet].every(k => providedSet.has(k as any));
      const marks = isCorrect ? 1 : 0;
      const maxMarks = 1;

      const domain = q.domain || 'General';
      if (!domainStats[domain]) domainStats[domain] = { correct: 0, total: 0, score: 0, maxScore: 0 };
      domainStats[domain].total += 1;
      domainStats[domain].maxScore += maxMarks;
      if (isCorrect) {
        domainStats[domain].correct += 1;
        domainStats[domain].score += marks;
      }
      totalScore += marks;
      maxTotal += maxMarks;

      answerRows.push({
        sessionId: session.id,
        candidateId: session.candidateId,
        questionId: q.id,
        position: i + 1,
        questionSnapshot: { content: q.content, options: q.options, domain: q.domain, difficulty: q.difficulty },
        candidateResponse: a.selected || [],
        isCorrect,
        correctAnswer: q.correctAnswer as any,
        timeSpentSeconds: a.timeSpentSeconds || 0,
        marks,
        maxMarks,
      });
    }

    // Per-domain percentage
    const domains = Object.entries(domainStats).map(([name, s]) => ({
      name,
      correct: s.correct,
      total: s.total,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
    }));
    const overallPercentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
    const passingThreshold = session.assessmentType.mcqPassThreshold || 60;
    const passed = overallPercentage >= passingThreshold;

    // Atomically: write answers, finalize session, publish report.
    await this.prisma.$transaction(async (tx) => {
      if (answerRows.length > 0) {
        await tx.examAnswer.createMany({ data: answerRows });
      }
      await tx.examSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED' as any,
          mcqSubmittedAt: new Date(),
        },
      });
      await tx.report.create({
        data: {
          sessionId: session.id,
          candidateId: session.candidateId,
          organizationId: session.organizationId,
          mcqScore: overallPercentage,
          mcqPassed: passed,
          mcqBreakdown: { domains, overallPercentage, totalScore, maxTotal, passingThreshold } as any,
          // Quiz mode has no practical / integrity to score — overall = MCQ.
          overallScore: overallPercentage,
          overallPassed: passed,
          integrityScore: 100, // no proctor data → assume clean
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    });

    return {
      submitted: true,
      score: { overallPercentage, totalScore, maxTotal, passingThreshold, passed },
      domains,
    };
  }

  /** Final report endpoint — candidates can see their own immediately. */
  async getReport(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        assessmentType: { select: { name: true } },
        organization: { select: { name: true, tradingName: true, logo: true, brandingConfig: true } },
      },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    const report = await this.prisma.report.findFirst({
      where: { sessionId: session.id },
      orderBy: { publishedAt: 'desc' },
    });
    if (!report) throw new NotFoundException('Report not yet available');
    return {
      candidateName: `${session.candidate.firstName} ${session.candidate.lastName}`.trim(),
      assessmentName: session.assessmentType.name,
      mcqScore: report.mcqScore,
      passed: report.mcqPassed,
      overallResult: report.mcqPassed ? 'PASS' : 'FAIL',
      breakdown: report.mcqBreakdown,
      submittedAt: session.mcqSubmittedAt,
      organization: {
        displayName: session.organization.tradingName || session.organization.name,
        logoUrl: session.organization.logo || null,
        brandColor: (session.organization.brandingConfig as any)?.brandColor || null,
      },
    };
  }

  // ── HR listing ──────────────────────────────────────────────────────────

  /** Quiz-only reports for HR review. Org-scoped. */
  async listReportsForOrg(organizationId: string) {
    return this.prisma.report.findMany({
      where: {
        organizationId,
        session: { mode: 'QUIZ' },
      },
      include: {
        session: {
          select: {
            id: true, scheduledAt: true, mcqSubmittedAt: true, mode: true,
            candidate: { select: { id: true, firstName: true, lastName: true, email: true, jobPosition: true } },
            assessmentType: { select: { name: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
  }
}

function maskEmail(email?: string | null): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local[0]}***@${domain}`;
}
