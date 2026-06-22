import { Injectable, Logger, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash, randomInt } from 'crypto';
import { SessionStatus } from '@prisma/client';
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
    // Valid SessionStatus terminal values: SUBMITTED, REPORT_PUBLISHED,
    // CANCELLED, NO_SHOW, DISQUALIFIED. Quiz mode flips to SUBMITTED then
    // immediately to REPORT_PUBLISHED when the report row is written.
    if (['SUBMITTED', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW', 'DISQUALIFIED'].includes(session.status)) {
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

  /**
   * Confirm the candidate's email matches the one on the session before
   * we expose anything else (name, OTP). Stops a shared link from being
   * used by someone else: only the intended recipient can move forward.
   * Returns the full name on success so the UI can greet them by name.
   */
  async confirmEmail(token: string, email: string) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email');
    }
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { candidate: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    if (session.candidate.email.toLowerCase() !== email.trim().toLowerCase()) {
      // Don't reveal whether the email exists in another tenant — just
      // refuse. Same shape as a wrong-link error from the candidate's
      // perspective.
      throw new UnauthorizedException('Email does not match the one this quiz was scheduled for');
    }
    const fullName = `${session.candidate.firstName} ${session.candidate.lastName}`.trim();
    return { confirmed: true, fullName };
  }

  /** Generate a 6-digit OTP, store its hash, email it to the candidate. */
  async sendOtp(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { candidate: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');

    // CSPRNG — Math.random() is predictable enough to brute-force a
    // 6-digit OTP within the 10-minute window. crypto.randomInt is the
    // standard Node-native CSPRNG and works without any new dep.
    const otp = String(randomInt(100000, 1000000));
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

  /**
   * Verify OTP atomically. Previous version read-then-wrote which
   * allowed two concurrent calls with the same OTP to both succeed
   * (one-time-use semantics broken). updateMany with the OTP hash in
   * the where clause does the check-and-clear as a single DB-level
   * compare-and-swap — the first request claims it, the second sees
   * `count === 0` and gets rejected.
   */
  async verifyOtp(token: string, otp: string) {
    if (!otp || !/^\d{6}$/.test(otp)) throw new BadRequestException('Enter the 6-digit code');

    // Cheap pre-checks: surface a clear "expired" / "request first" /
    // "not a quiz" error rather than a generic "invalid code" message.
    // These reads don't have to be atomic because the actual claim is.
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, mode: true, quizOtpHash: true, quizOtpExpiresAt: true, tokenUsedAt: true },
    });
    if (!session) throw new NotFoundException('Invalid quiz link');
    if (session.mode !== 'QUIZ') throw new BadRequestException('Not a quiz session');
    if (!session.quizOtpHash || !session.quizOtpExpiresAt) {
      throw new BadRequestException('Request an access code first');
    }
    if (session.quizOtpExpiresAt < new Date()) throw new BadRequestException('Access code expired');

    const provided = createHash('sha256').update(otp).digest('hex');

    // ATOMIC compare-and-swap. Only succeeds if (a) the magicToken
    // still matches, (b) the stored hash still equals the provided
    // one, (c) the expiry is still in the future. On success the
    // OTP is cleared in the same statement so no concurrent caller
    // can re-use it.
    const result = await this.prisma.examSession.updateMany({
      where: {
        id: session.id,
        quizOtpHash: provided,
        quizOtpExpiresAt: { gt: new Date() },
      },
      data: {
        quizOtpHash: null,
        quizOtpExpiresAt: null,
        tokenUsedAt: session.tokenUsedAt || new Date(),
      },
    });
    if (result.count !== 1) {
      // Two failure modes collapse here: wrong code, or someone else
      // already claimed it. Returning 401 either way matches the
      // candidate's expectation and avoids leaking which it was.
      throw new UnauthorizedException('Invalid access code');
    }
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
    // Valid SessionStatus terminal values: SUBMITTED, REPORT_PUBLISHED,
    // CANCELLED, NO_SHOW, DISQUALIFIED. Quiz mode flips to SUBMITTED then
    // immediately to REPORT_PUBLISHED when the report row is written.
    if (['SUBMITTED', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW', 'DISQUALIFIED'].includes(session.status)) {
      throw new BadRequestException('Quiz already submitted');
    }

    // First call → flip to MCQ_IN_PROGRESS.
    if (session.status !== 'MCQ_IN_PROGRESS') {
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.MCQ_IN_PROGRESS, mcqStartedAt: new Date() },
      });
    }

    const target = session.assessmentType.mcqQuestionCount || 20;
    const all = await this.prisma.question.findMany({
      where: { assessmentTypeId: session.assessmentType.id },
      select: { id: true, type: true, content: true, options: true, domain: true, difficulty: true },
    });
    // Fisher-Yates with crypto.randomInt — `arr.sort(() => Math.random() - 0.5)`
    // is biased (non-uniform distribution) AND predictable (gameable by anyone
    // who controls the seed). This gives a uniformly-random permutation from
    // a CSPRNG source.
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, target);

    return {
      durationMinutes: session.assessmentType.mcqTimeLimit || 30,
      startedAt: session.mcqStartedAt || new Date(),
      questions: picked.map((q, i) => ({
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
    // Valid SessionStatus terminal values: SUBMITTED, REPORT_PUBLISHED,
    // CANCELLED, NO_SHOW, DISQUALIFIED. Quiz mode flips to SUBMITTED then
    // immediately to REPORT_PUBLISHED when the report row is written.
    if (['SUBMITTED', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW', 'DISQUALIFIED'].includes(session.status)) {
      throw new BadRequestException('Quiz already submitted');
    }

    // Pull every referenced question in one query for grading.
    const ids = body.answers.map(a => a.questionId).filter(Boolean);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
    });

    // Grading runs in a pure helper (gradeAnswers, exported below) so we
    // can unit-test it without spinning up Prisma. The helper produces
    // the per-question rows + per-domain aggregate; the service just
    // attaches session/candidate ids before writing.
    const { totalScore, maxTotal, domainStats, answerRows: answerRowsRaw } = gradeAnswers(body.answers, questions);
    const answerRows = answerRowsRaw.map(r => ({
      ...r,
      sessionId: session.id,
      candidateId: session.candidateId,
    }));

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

    // Atomically: clear any prior answers from a half-finished attempt,
    // write the fresh ones, finalize the session, publish (or update) the
    // report. Upsert on the (sessionId, candidateId) compound key handles
    // re-submits cleanly — Report.create would 500 on the second attempt.
    try {
      await this.prisma.$transaction(async (tx) => {
        // Clean slate for THIS candidate — defensive against the rare case
        // of a half-written previous attempt left over from a crash.
        await tx.examAnswer.deleteMany({
          where: { sessionId: session.id, candidateId: session.candidateId },
        });
        if (answerRows.length > 0) {
          await tx.examAnswer.createMany({ data: answerRows });
        }
        await tx.examSession.update({
          where: { id: session.id },
          data: {
            // REPORT_PUBLISHED — quiz mode is auto-published on submit, so
            // skip SUBMITTED/GRADING/PENDING_PROCTOR_REVIEW intermediate
            // states that only the proctored flow needs.
            status: SessionStatus.REPORT_PUBLISHED,
            mcqSubmittedAt: new Date(),
          },
        });
        await tx.report.upsert({
          where: {
            sessionId_candidateId: {
              sessionId: session.id,
              candidateId: session.candidateId,
            },
          },
          create: {
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
          update: {
            mcqScore: overallPercentage,
            mcqPassed: passed,
            mcqBreakdown: { domains, overallPercentage, totalScore, maxTotal, passingThreshold } as any,
            overallScore: overallPercentage,
            overallPassed: passed,
            integrityScore: 100,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
      });
    } catch (err: any) {
      // Make the failure mode visible in pm2 logs so future "500 on
      // submit" reports can be traced quickly. The candidate sees a
      // generic message but our log line has the full reason.
      this.logger.error(
        `Quiz submit failed for session=${session.id} candidate=${session.candidateId}: ` +
        `${err?.code || ''} ${err?.message || err}`,
      );
      throw new BadRequestException(
        'Could not finalise your submission. Please try again, or contact HR if this persists.',
      );
    }

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

  /**
   * Full Q&A detail for HR's expanded view. Returns every answer the
   * candidate submitted with the question text, the choice they made,
   * the correct choice, whether they got it right, and how long they
   * spent. Org-scoped — refuses cross-tenant reads.
   */
  async getReportDetail(reportId: string, organizationId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, organizationId },
      include: {
        session: {
          include: {
            candidate: { select: { firstName: true, lastName: true, email: true, jobPosition: true } },
            assessmentType: { select: { name: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.session.mode !== 'QUIZ') {
      throw new BadRequestException('Detail view is only for quiz reports');
    }

    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId: report.sessionId, candidateId: report.candidateId },
      orderBy: { position: 'asc' },
    });

    return {
      reportId: report.id,
      candidate: report.session.candidate,
      assessmentName: report.session.assessmentType.name,
      submittedAt: report.session.mcqSubmittedAt,
      overall: {
        score: report.mcqScore,
        passed: report.mcqPassed,
        result: report.mcqPassed ? 'PASS' : 'FAIL',
        breakdown: report.mcqBreakdown,
      },
      questions: answers.map(a => {
        const snap = a.questionSnapshot as any;
        return {
          position: a.position,
          domain: snap?.domain || 'General',
          content: snap?.content || {},
          options: snap?.options || [],
          candidateResponse: a.candidateResponse,
          correctAnswer: a.correctAnswer,
          isCorrect: a.isCorrect,
          timeSpentSeconds: a.timeSpentSeconds,
          marks: a.marks,
          maxMarks: a.maxMarks,
        };
      }),
    };
  }

  /**
   * Render a quiz report to PDF via Puppeteer and stream it back to HR.
   * Reuses the report-detail payload so the PDF mirrors the on-screen
   * view exactly: org branding, overall score, per-domain breakdown,
   * and every question with the candidate's response + correct answer.
   *
   * Returns the PDF as a Buffer; the controller pipes it to the
   * response with a Content-Disposition header so browsers prompt for
   * download.
   */
  async generateReportPdf(reportId: string, organizationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.getReportDetail(reportId, organizationId);
    // Pull org branding for the header.
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, tradingName: true, logo: true, brandingConfig: true },
    });
    const branding = {
      displayName: org?.tradingName || org?.name || 'assessexpert',
      logoUrl: org?.logo || null,
      brandColor: (org?.brandingConfig as any)?.brandColor || '#00D4FF',
    };

    const html = this.buildQuizReportHtml(detail, branding);

    // Lazy-load puppeteer so the rest of the app still boots if its
    // bundled Chromium failed to download. Same pattern as the proctored
    // PDF generator.
    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer');
    } catch (e: any) {
      this.logger.error('puppeteer not available: ' + (e?.message || e));
      throw new BadRequestException('PDF generation is unavailable on this server. Run `npm install` to install puppeteer.');
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;color:#94A3B8;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>${escapeHtml(branding.displayName)} · Quiz Report</span><span class="date"></span></div>`,
        footerTemplate: `<div style="font-size:9px;color:#94A3B8;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>Generated <span class="date"></span></span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
      const candidateName = `${detail.candidate.firstName} ${detail.candidate.lastName}`.trim() || detail.candidate.email;
      const safeName = candidateName.replace(/[^a-zA-Z0-9-]+/g, '_');
      return {
        buffer: Buffer.from(buffer),
        filename: `quiz-report-${safeName}-${detail.reportId}.pdf`,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  private buildQuizReportHtml(d: any, brand: { displayName: string; logoUrl: string | null; brandColor: string }): string {
    const candidateName = `${d.candidate.firstName || ''} ${d.candidate.lastName || ''}`.trim() || d.candidate.email;
    const overall = d.overall || {};
    const breakdown = (overall.breakdown || {}) as any;
    const domains: any[] = breakdown.domains || [];
    const passed = overall.passed;
    const dateStr = d.submittedAt ? new Date(d.submittedAt).toLocaleString() : '—';

    const logoHtml = brand.logoUrl
      ? `<img src="${brand.logoUrl}" alt="logo" style="height:40px;width:auto;object-fit:contain;margin-right:14px"/>`
      : '';

    const domainRows = domains.map(dom => `
      <tr>
        <td style="padding:6px 10px;font-size:11px;color:#0f172a">${escapeHtml(dom.name)}</td>
        <td style="padding:6px 10px;font-size:11px;color:#475569;text-align:right">${dom.correct} / ${dom.total}</td>
        <td style="padding:6px 10px;font-size:11px;color:#475569;text-align:right;font-weight:600">${dom.percentage}%</td>
        <td style="padding:6px 10px;width:140px">
          <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${dom.percentage}%;background:${dom.percentage >= 60 ? '#10b981' : '#f59e0b'}"></div>
          </div>
        </td>
      </tr>
    `).join('');

    const questionsHtml = (d.questions || []).map((q: any) => {
      const selected: string[] = Array.isArray(q.candidateResponse) ? q.candidateResponse : [];
      const correct: string[] = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
      const optsHtml = (q.options || []).map((opt: any) => {
        const isPicked = selected.includes(opt.key);
        const isRight = correct.includes(opt.key);
        let bg = '#fff', border = '#e2e8f0', color = '#475569';
        if (isRight) { bg = '#f0fdf4'; border = '#86efac'; color = '#15803d'; }
        if (isPicked && !isRight) { bg = '#fef2f2'; border = '#fca5a5'; color = '#991b1b'; }
        const chips = `${isPicked ? `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:${isRight ? '#dcfce7' : '#fee2e2'};color:${isRight ? '#15803d' : '#991b1b'};margin-left:8px">CANDIDATE</span>` : ''}${isRight ? `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:#dcfce7;color:#15803d;margin-left:6px">CORRECT</span>` : ''}`;
        return `
          <div style="padding:7px 10px;border-radius:5px;border:1px solid ${border};background:${bg};margin-bottom:4px;font-size:11px;color:${color};display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <span><strong style="margin-right:6px">${escapeHtml(opt.key)}.</strong>${escapeHtml(opt.text)}</span>
            <span style="flex-shrink:0">${chips}</span>
          </div>
        `;
      }).join('');
      const codeHtml = q.content?.codeBlock
        ? `<pre style="background:#0f172a;color:#e2e8f0;padding:8px;border-radius:5px;font-size:10px;overflow-x:auto;margin:8px 0">${escapeHtml(q.content.codeBlock)}</pre>`
        : '';
      const stripe = q.isCorrect ? '#10b981' : '#ef4444';
      const verdict = q.isCorrect
        ? `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:#dcfce7;color:#15803d">CORRECT</span>`
        : `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;background:#fee2e2;color:#991b1b">INCORRECT</span>`;
      return `
        <div style="padding:10px 12px;margin-bottom:10px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid ${stripe};page-break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-size:10px;color:#64748b">#${q.position} · ${escapeHtml(q.domain || 'General')}</div>
            ${verdict}
          </div>
          <p style="margin:0;font-size:12px;color:#0f172a;line-height:1.5;margin-bottom:8px">${escapeHtml(q.content?.text || '')}</p>
          ${codeHtml}
          ${optsHtml}
        </div>
      `;
    }).join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;margin:0;padding:0}</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;align-items:center;padding:0 0 14px;border-bottom:2px solid ${brand.brandColor}">
    ${logoHtml}
    <div>
      <div style="font-size:18px;font-weight:700;color:${brand.brandColor};line-height:1.1">${escapeHtml(brand.displayName)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">Quiz Assessment Report</div>
    </div>
  </div>

  <!-- Candidate / overall -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:18px 0 14px">
    <div>
      <div style="font-size:11px;color:#64748b">Candidate</div>
      <div style="font-size:15px;font-weight:600;color:#0f172a;line-height:1.2">${escapeHtml(candidateName)}</div>
      <div style="font-size:11px;color:#475569;margin-top:2px">${escapeHtml(d.candidate.email || '')}</div>
      <div style="font-size:11px;color:#475569">${escapeHtml(d.candidate.jobPosition || '')}</div>
      <div style="font-size:11px;color:#64748b;margin-top:6px">Submitted: ${dateStr}</div>
      <div style="font-size:11px;color:#64748b">Assessment: ${escapeHtml(d.assessmentName || '')}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:32px;font-weight:700;color:${passed ? '#10b981' : '#ef4444'};line-height:1">${Math.round(overall.score || 0)}<span style="font-size:14px;color:#64748b">%</span></div>
      <div style="font-size:10px;color:#64748b">overall</div>
      <div style="margin-top:6px;display:inline-block;padding:4px 12px;border-radius:5px;background:${passed ? '#dcfce7' : '#fee2e2'};color:${passed ? '#15803d' : '#991b1b'};font-size:12px;font-weight:700">${overall.result || (passed ? 'PASS' : 'FAIL')}</div>
    </div>
  </div>

  <!-- Per-domain -->
  ${domains.length > 0 ? `
    <div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Score by topic</div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px">${domainRows}</table>
    </div>
  ` : ''}

  <!-- Q&A -->
  <div>
    <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Question-by-question</div>
    ${questionsHtml}
  </div>
</body></html>`;
  }

  /** Quiz-only reports for HR review. Org-scoped + feature-flag gated. */
  async listReportsForOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { quizEnabled: true },
    });
    if (!org?.quizEnabled) {
      throw new BadRequestException(
        'Quiz mode is not enabled for this organization.',
      );
    }
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

// ── Pure helpers (exported for unit tests) ─────────────────────────────────

export type GradeInputAnswer = { questionId: string; selected: string[]; timeSpentSeconds?: number };
export type GradeInputQuestion = {
  id: string;
  domain: string;
  difficulty?: any;
  content?: any;
  options?: any;
  correctAnswer: any; // JsonValue from Prisma; expected to be string[]
};
export type DomainStats = Record<string, { correct: number; total: number; score: number; maxScore: number }>;

/**
 * Grade a set of candidate answers against the question bank. Pure
 * function — no DB, no side effects. Returns per-question rows ready
 * for ExamAnswer.createMany (minus sessionId/candidateId which the
 * caller attaches), plus per-domain aggregate and totals.
 *
 * Grading rules (MCQ):
 *  - SINGLE_SELECT / MULTI_SELECT both use exact-set match. Order of
 *    keys doesn't matter; partial credit is not awarded.
 *  - Missing question id in the bank is skipped (not graded).
 *  - Empty selected[] counts as a wrong answer with marks=0.
 *  - Per-question marks default to 1; assessment weighting would
 *    extend this if/when it lands.
 */
export function gradeAnswers(
  answers: GradeInputAnswer[],
  questions: GradeInputQuestion[],
): { totalScore: number; maxTotal: number; domainStats: DomainStats; answerRows: any[] } {
  const byId = new Map(questions.map(q => [q.id, q]));
  const domainStats: DomainStats = {};
  let totalScore = 0;
  let maxTotal = 0;
  const answerRows: any[] = [];

  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
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
      questionId: q.id,
      position: i + 1,
      questionSnapshot: { content: q.content, options: q.options, domain: q.domain, difficulty: q.difficulty },
      candidateResponse: a.selected || [],
      isCorrect,
      correctAnswer: q.correctAnswer,
      timeSpentSeconds: a.timeSpentSeconds || 0,
      marks,
      maxMarks,
    });
  }

  return { totalScore, maxTotal, domainStats, answerRows };
}

// Minimal HTML escape for values interpolated into the PDF template. The
// values come from our own DB (question text, candidate name, option
// labels) but we still sanitise to defend against XSS via stored
// content in case a CMS_ADMIN account is ever compromised.
function escapeHtml(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskEmail(email?: string | null): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local[0]}***@${domain}`;
}
