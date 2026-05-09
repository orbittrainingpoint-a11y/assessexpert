import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ReportsService {
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateDraftReport(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        assessmentType: true,
        answers: { orderBy: { position: 'asc' } },
        events: true,
        frLogs: true,
        practicalTask: true,
        organization: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Build MCQ breakdown
    const mcqBreakdown = session.answers.map(answer => {
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
Candidate: ${session.candidate.firstName} ${session.candidate.lastName}
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
      aiNarrative = `Candidate ${session.candidate.firstName} ${session.candidate.lastName} completed the ${session.assessmentType.name} assessment. MCQ score: ${mcqScore.toFixed(1)}%.`;
      aiRecommendation = mcqPassed ? 'Candidate meets the minimum threshold. Recommend proceeding to interview.' : 'Candidate did not meet the minimum threshold.';
    }

    // Upsert report
    const report = await this.prisma.report.upsert({
      where: { sessionId },
      create: {
        sessionId,
        organizationId: session.organizationId,
        candidateId: session.candidateId,
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

    // Update session status
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'PENDING_PROCTOR_REVIEW', integrityScore },
    });

    return report;
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

  async getReportBySession(sessionId: string, requestingUser: any) {
    const report = await this.prisma.report.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: { candidate: true, assessmentType: true, practicalTask: true, events: true, frLogs: true },
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

  async updateProctorFields(sessionId: string, data: {
    proctorNarrative?: string;
    proctorVerdict?: string;
    practicalQuality?: string;
    proctorOverrides?: any;
    practicalScore?: number;
  }, proctorId: string) {
    const report = await this.prisma.report.findUnique({ where: { sessionId } });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { sessionId },
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
      },
    });
  }

  async publishReport(sessionId: string, proctorId: string) {
    const report = await this.prisma.report.findUnique({ where: { sessionId } });
    if (!report) throw new NotFoundException('Report not found');
    if (!report.proctorNarrative || report.proctorNarrative.length < 50) {
      throw new BadRequestException('Proctor narrative must be at least 50 characters');
    }
    if (!report.proctorVerdict) {
      throw new BadRequestException('Proctor verdict is required before publishing');
    }

    const published = await this.prisma.report.update({
      where: { sessionId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: proctorId,
        pdfVersion: report.pdfVersion,
      },
    });

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'REPORT_PUBLISHED' },
    });

    return published;
  }

  async getReportsForOrg(organizationId: string, filters?: any) {
    const where: any = { organizationId, status: 'PUBLISHED' };
    if (filters?.from) where.publishedAt = { gte: new Date(filters.from) };
    return this.prisma.report.findMany({
      where,
      include: {
        session: { include: { candidate: true, assessmentType: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
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

  async getAllReports(filters?: any) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
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

  async rateReport(sessionId: string, rating: number, note: string, userId: string) {
    return this.prisma.report.update({
      where: { sessionId },
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
