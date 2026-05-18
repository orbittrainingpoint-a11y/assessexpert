import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NotificationsService } from '../notifications/notifications.service';
import { AppGateway } from '../gateway/app.gateway';

@Injectable()
export class ReportsService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private gateway: AppGateway,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateDraftReport(sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        assessmentType: true,
        events: true,
        frLogs: true,
        practicalTask: true,
        organization: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Resolve which candidate this report is FOR. Multi-candidate slots
    // get one report per candidate; single-candidate sessions fall back
    // to the primary candidate so existing callers keep working.
    const cId = candidateId || session.candidateId;

    // The candidate used to be implicit on session.candidate, but multi-
    // candidate slots may want the report-target candidate to be different.
    const targetCandidate = cId === session.candidateId
      ? session.candidate
      : (session.sessionCandidates.find(sc => sc.candidateId === cId)?.candidate || session.candidate);

    // Pull THIS candidate's answers only — per-candidate from batch 4a.
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId, candidateId: cId },
      orderBy: { position: 'asc' },
    });

    // Build MCQ breakdown
    const mcqBreakdown = answers.map(answer => {
      const snapshot = answer.questionSnapshot as any;
      const options = snapshot.options as any[];
      const candidateResp = answer.candidateResponse as any;
      const correctAns = answer.correctAnswer as any;

      const candidateAnswerText = options.find(o => o.key === candidateResp)?.text || String(candidateResp);
      const correctAnswerText = Array.isArray(correctAns)
        ? correctAns.map(k => options.find(o => o.key === k)?.text || k).join(', ')
        : options.find(o => o.key === correctAns)?.text || String(correctAns);

      return {
        position: answer.position,
        questionText: snapshot.content?.text || '',
        options: options.map(o => `${o.key}. ${o.text}`),
        candidateAnswer: candidateResp,
        candidateAnswerText,
        correctAnswer: correctAns,
        correctAnswerText,
        isCorrect: answer.isCorrect,
        timeSpentSeconds: answer.timeSpentSeconds,
        marks: answer.marks,
        maxMarks: answer.maxMarks,
      };
    });

    const totalCorrect = mcqBreakdown.filter(q => q.isCorrect).length;
    const totalIncorrect = mcqBreakdown.filter(q => !q.isCorrect).length;
    const mcqScore = session.assessmentType.mcqQuestionCount > 0
      ? (totalCorrect / session.assessmentType.mcqQuestionCount) * 100
      : 0;
    const mcqPassed = mcqScore >= session.assessmentType.mcqPassThreshold;

    // Calculate integrity score
    const criticalEvents = session.events.filter(e => e.severity === 'CRITICAL').length;
    const warningEvents = session.events.filter(e => e.severity === 'WARNING').length;
    const integrityScore = Math.max(0, 100 - (criticalEvents * 15) - (warningEvents * 5));

    // Generate AI narrative using Gemini
    let aiNarrative = '';
    let aiRecommendation = '';
    try {
      const model = this.genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

      const narrativeResult = await model.generateContent(
        `You are an expert HR assessment evaluator. Generate a professional assessment report narrative for:
Candidate: ${targetCandidate.firstName} ${targetCandidate.lastName}
Assessment: ${session.assessmentType.name}
MCQ Score: ${mcqScore.toFixed(1)}% (${totalCorrect}/${session.assessmentType.mcqQuestionCount} correct)
MCQ Passed: ${mcqPassed}
Integrity Score: ${integrityScore}/100
AI Events: ${session.events.length} total (${criticalEvents} critical, ${warningEvents} warnings)

Write 2-3 professional paragraphs analyzing the candidate's performance. Be objective and specific.`
      );
      aiNarrative = narrativeResult.response.text();

      const recResult = await model.generateContent(
        `Based on: MCQ ${mcqScore.toFixed(1)}%, Integrity ${integrityScore}/100, Passed: ${mcqPassed}.
Give a 1-paragraph hiring recommendation: Hire / Do Not Hire / Proceed with Caution. Be direct.`
      );
      aiRecommendation = recResult.response.text();
    } catch (e) {
      aiNarrative = `Candidate ${targetCandidate.firstName} ${targetCandidate.lastName} completed the ${session.assessmentType.name} assessment. MCQ score: ${mcqScore.toFixed(1)}%.`;
      aiRecommendation = mcqPassed ? 'Candidate meets the minimum threshold. Recommend proceeding to interview.' : 'Candidate did not meet the minimum threshold.';
    }

    // Upsert THIS candidate's report row (composite key sessionId + candidateId).
    const report = await this.prisma.report.upsert({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      create: {
        sessionId,
        organizationId: session.organizationId,
        candidateId: cId,
        mcqScore,
        mcqPassed,
        mcqBreakdown: { questions: mcqBreakdown, totalCorrect, totalIncorrect, totalMcqScore: mcqScore, mcqPassed },
        overallScore: mcqScore,
        overallPassed: mcqPassed,
        integrityScore,
        aiNarrative,
        aiRecommendation,
        status: 'DRAFT',
      },
      update: {
        mcqScore,
        mcqPassed,
        mcqBreakdown: { questions: mcqBreakdown, totalCorrect, totalIncorrect, totalMcqScore: mcqScore, mcqPassed },
        overallScore: mcqScore,
        overallPassed: mcqPassed,
        integrityScore,
        aiNarrative,
        aiRecommendation,
        status: 'PENDING_REVIEW',
      },
    });

    // Update session status — moves once even if multiple reports are
    // generated in sequence for a multi-candidate slot.
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'PENDING_PROCTOR_REVIEW', integrityScore },
    });

    return report;
  }

  // Generate reports for EVERY candidate in a multi-candidate slot.
  // Calls generateDraftReport once per candidate; returns the array.
  async generateAllReportsForSession(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, sessionCandidates: { select: { candidateId: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    const ids = new Set<string>([session.candidateId]);
    session.sessionCandidates.forEach(sc => ids.add(sc.candidateId));
    const reports = [];
    for (const cid of ids) {
      reports.push(await this.generateDraftReport(sessionId, cid));
    }
    return reports;
  }

  async getReport(id: string, requestingUser: any) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        session: {
          include: { candidate: true, assessmentType: true, practicalTask: true },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    // HR can only see published reports
    if (['HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN'].includes(requestingUser.role)) {
      if (report.status !== 'PUBLISHED') throw new ForbiddenException('Report not yet published');
      if (report.organizationId !== requestingUser.organizationId) throw new ForbiddenException('Access denied');
    }

    return report;
  }

  // Returns the report for a session. If candidateId is omitted, falls
  // back to the session's primary candidate (single-candidate behaviour).
  // Multi-candidate slots should always pass candidateId; the list of
  // reports for a session is available via reportsForSession().
  async getReportBySession(sessionId: string, requestingUser: any, candidateId?: string) {
    const cId = candidateId || (await this.primaryCandidateId(sessionId));
    const report = await this.prisma.report.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      include: {
        session: {
          include: { candidate: true, assessmentType: true, practicalTask: true, events: true, frLogs: true, sessionCandidates: { include: { candidate: true } } },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    if (['HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN'].includes(requestingUser.role)) {
      if (report.status !== 'PUBLISHED') throw new ForbiddenException('Report not yet published');
      if (report.organizationId !== requestingUser.organizationId) throw new ForbiddenException('Access denied');
    }

    return report;
  }

  // Helper — resolve the primary candidate for a session.
  private async primaryCandidateId(sessionId: string): Promise<string> {
    const s = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true },
    });
    if (!s) throw new NotFoundException('Session not found');
    return s.candidateId;
  }

  // All per-candidate reports for a session (multi-candidate aware).
  async reportsForSession(sessionId: string) {
    return this.prisma.report.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateProctorFields(sessionId: string, data: {
    proctorNarrative?: string;
    proctorVerdict?: string;
    practicalQuality?: string;
    proctorOverrides?: any;
    practicalScore?: number;
    candidateId?: string;
  }, proctorId: string) {
    const cId = data.candidateId || (await this.primaryCandidateId(sessionId));
    const report = await this.prisma.report.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      data: {
        proctorNarrative: data.proctorNarrative,
        proctorVerdict: data.proctorVerdict as any,
        practicalQuality: data.practicalQuality as any,
        proctorOverrides: data.proctorOverrides,
        practicalScore: data.practicalScore,
        practicalPassed: data.practicalScore !== undefined
          ? data.practicalScore >= 60
          : undefined,
        status: 'PENDING_REVIEW',
        // Content changed — invalidate the cached PDF so the next fetch
        // re-renders with the proctor's latest narrative + verdict.
        pdfVersion: { increment: 1 },
        pdfPath: null,
      },
    });
  }

  async publishReport(sessionId: string, proctorId: string, candidateId?: string) {
    const cId = candidateId || (await this.primaryCandidateId(sessionId));
    const report = await this.prisma.report.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!report.proctorNarrative || report.proctorNarrative.length < 50) {
      throw new BadRequestException('Proctor narrative must be at least 50 characters');
    }
    if (!report.proctorVerdict) {
      throw new BadRequestException('Proctor verdict is required before publishing');
    }

    const published = await this.prisma.report.update({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: proctorId,
        // Bump version + drop cached PDF path so the next download triggers
        // a fresh render with the final published content.
        pdfVersion: { increment: 1 },
        pdfPath: null,
      },
    });

    // Move the session into REPORT_PUBLISHED only when EVERY candidate's
    // report is published (multi-candidate). Single-candidate sessions
    // flip on the first publish.
    const reports = await this.prisma.report.findMany({
      where: { sessionId },
      select: { status: true },
    });
    const allPublished = reports.length > 0 && reports.every(r => r.status === 'PUBLISHED');
    if (allPublished) {
      await this.prisma.examSession.update({
        where: { id: sessionId },
        data: { status: 'REPORT_PUBLISHED' },
      });
    }

    // Notify HR via email + in-portal WebSocket — load the FOR-THIS-CANDIDATE
    // info so multi-candidate slots send the right name.
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        assessmentType: true,
        organization: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    const reportCandidate = cId === session?.candidateId
      ? session?.candidate
      : (session?.sessionCandidates.find(sc => sc.candidateId === cId)?.candidate);
    const proctor = await this.prisma.user.findUnique({ where: { id: proctorId }, select: { firstName: true, lastName: true } });
    const hrUsers = await this.prisma.user.findMany({
      where: { organizationId: session?.organizationId, role: { in: ['HR_MANAGER', 'ORG_ADMIN'] }, status: 'ACTIVE' },
    });

    for (const hr of hrUsers) {
      // Email notification
      await this.notifications.sendReportPublishedNotification(
        hr.email,
        `${hr.firstName} ${hr.lastName}`,
        {
          candidateName: reportCandidate ? `${reportCandidate.firstName} ${reportCandidate.lastName}` : '',
          assessmentType: session?.assessmentType.name || '',
          sessionDate: session?.scheduledAt || new Date(),
          overallResult: published.overallPassed ? 'PASS' : 'FAIL',
          mcqScore: published.mcqScore,
          proctorName: proctor ? `${proctor.firstName} ${proctor.lastName}` : 'Proctor',
          dashboardUrl: `${process.env.FRONTEND_URL}/hr/assessments`,
        },
      ).catch(() => {});
      // In-portal notification
      await this.notifications.createPortalNotification(
        hr.id,
        'REPORT_PUBLISHED',
        'Report Published',
        `Assessment report for ${reportCandidate?.firstName || ''} ${reportCandidate?.lastName || ''} is now available.`,
        { sessionId, reportId: published.id, candidateId: cId },
        `/hr/assessments/${sessionId}`,
      ).catch(() => {});
    }

    // Emit WebSocket to HR org room
    this.gateway.emitToAll('report.published', {
      organizationId: session?.organizationId,
      candidateName: reportCandidate ? `${reportCandidate.firstName} ${reportCandidate.lastName}` : '',
      candidateId: cId,
      sessionId,
      reportId: published.id,
    });

    return published;
  }

  async getReportsForOrg(organizationId: string, filters?: any) {
    if (!organizationId) {
      return { reports: [], total: 0 };
    }
    // HR only ever sees PUBLISHED reports, unless they explicitly filter
    // (and even then it's still scoped to PUBLISHED for safety).
    const where: any = { organizationId, status: 'PUBLISHED' };
    if (filters?.from) where.publishedAt = { gte: new Date(filters.from) };
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          session: { include: { candidate: true, assessmentType: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: parseInt(filters?.limit) || 200,
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { reports, total };
  }

  async getReportsForProctor(proctorId: string) {
    return this.prisma.report.findMany({
      where: {
        session: { proctorId },
        status: { in: ['PENDING_REVIEW', 'RETURNED'] },
      },
      include: {
        session: { include: { candidate: true, assessmentType: true, organization: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Map old/long status names from the frontend to the actual Prisma enum.
  // The UI uses descriptive labels for clarity but the DB has shorter values.
  private normalizeReportStatus(s?: string): string | undefined {
    if (!s) return undefined;
    const map: Record<string, string> = {
      PENDING_PROCTOR_REVIEW: 'PENDING_REVIEW',
      RETURNED_FOR_MODIFICATION: 'RETURNED',
      // Accept canonical values too
      DRAFT: 'DRAFT',
      PENDING_REVIEW: 'PENDING_REVIEW',
      RETURNED: 'RETURNED',
      PUBLISHED: 'PUBLISHED',
    };
    return map[s] ?? s;
  }

  async getAllReports(filters?: any) {
    const where: any = {};
    const normalized = this.normalizeReportStatus(filters?.status);
    if (normalized) where.status = normalized;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    return this.prisma.report.findMany({
      where,
      include: {
        session: { include: { candidate: true, assessmentType: true, organization: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(filters?.limit) || 50,
      skip: parseInt(filters?.offset) || 0,
    });
  }

  async rateReport(sessionId: string, rating: number, note: string, userId: string, candidateId?: string) {
    const cId = candidateId || (await this.primaryCandidateId(sessionId));
    return this.prisma.report.update({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      data: { hrRating: rating, hrRatingNote: note },
    });
  }

  async returnForModification(reportId: string, instructions: string, masterProctorId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'RETURNED',
        masterProctorReview: {
          returnedBy: masterProctorId,
          returnedAt: new Date().toISOString(),
          instructions,
        },
      },
    });
  }
}
