import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async createSession(data: {
    assessmentTypeId: string;
    candidateId: string;
    organizationId: string;
    proctorId?: string;
    scheduledAt: Date;
  }) {
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours from scheduled time

    const session = await this.prisma.examSession.create({
      data: {
        ...data,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
      },
      include: { candidate: true, assessmentType: true },
    });

    return session;
  }

  async getSession(id: string, organizationId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: true,
        assessmentType: true,
        checklist: true,
        questionAssignment: true,
        report: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (organizationId && session.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return session;
  }

  async getSessionByToken(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: {
        candidate: true,
        assessmentType: true,
        checklist: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionsForProctor(proctorId: string, date?: string) {
    const where: any = { proctorId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
    return this.prisma.examSession.findMany({
      where,
      include: { candidate: true, assessmentType: true, organization: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getSessionsForOrg(organizationId: string, filters?: any) {
    const where: any = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from && filters?.to) {
      where.scheduledAt = { gte: new Date(filters.from), lte: new Date(filters.to) };
    }
    return this.prisma.examSession.findMany({
      where,
      include: { candidate: true, assessmentType: true },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAllSessions(filters?: any) {
    const where: any = {};
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.status) where.status = filters.status;
    if (filters?.proctorId) where.proctorId = filters.proctorId;
    return this.prisma.examSession.findMany({
      where,
      include: { candidate: true, assessmentType: true, organization: true },
      orderBy: { scheduledAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
    });
  }

  async getLiveSessions() {
    return this.prisma.examSession.findMany({
      where: {
        status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'CHECKLIST', 'WAITING_ROOM'] },
      },
      include: { candidate: true, assessmentType: true, organization: true },
    });
  }

  async updateSessionStatus(id: string, status: string, additionalData?: any) {
    return this.prisma.examSession.update({
      where: { id },
      data: { status: status as any, ...additionalData },
    });
  }

  async startMcq(sessionId: string, proctorId: string) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'CHECKLIST') {
      throw new BadRequestException('Checklist must be completed before starting MCQ');
    }
    const checklist = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    if (!checklist?.completedAt) {
      throw new ForbiddenException('Proctor checklist must be fully completed before starting the exam');
    }

    // Draw 25 questions via Fisher-Yates shuffle
    const pool = await this.prisma.question.findMany({
      where: { assessmentTypeId: session.assessmentTypeId, status: 'ACTIVE' },
    });
    if (pool.length < 25) {
      throw new BadRequestException(`Insufficient active questions: ${pool.length} found, 25 required.`);
    }
    const seed = randomBytes(16).toString('hex');
    const arr = [...pool];
    let seedNum = parseInt(seed.substring(0, 8), 16);
    for (let i = arr.length - 1; i > 0; i--) {
      seedNum = (seedNum * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(seedNum) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const selected = arr.slice(0, 25);
    const questionOrder = selected.map((q, i) => ({ questionId: q.id, position: i + 1, answeredAt: null, timeSpentSeconds: null }));

    await this.prisma.sessionQuestionAssignment.upsert({
      where: { sessionId },
      create: { sessionId, questionIds: selected.map(q => q.id), questionOrder, shuffleSeed: seed, generatedByProctorId: proctorId },
      update: { questionIds: selected.map(q => q.id), questionOrder, shuffleSeed: seed, generatedByProctorId: proctorId },
    });

    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS', mcqStartedAt: new Date() },
    });
  }

  async completeMcq(sessionId: string) {
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_COMPLETE', mcqSubmittedAt: new Date() },
    });
  }

  async assignPracticalTask(sessionId: string, practicalTaskId: string, proctorId: string) {
    const session = await this.getSession(sessionId);
    const allowedStatuses = ['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException('MCQ must be completed before assigning practical task');
    }
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        practicalTaskId,
        status: 'PRACTICAL_IN_PROGRESS',
        practicalStartedAt: new Date(),
      },
      include: { practicalTask: true },
    });
  }

  async submitPractical(sessionId: string, filePath?: string, fileName?: string) {
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: 'SUBMITTED',
        practicalSubmittedAt: new Date(),
        practicalFilePath: filePath,
        practicalFileName: fileName,
        recordingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async terminateSession(sessionId: string, reason: string, proctorId: string) {
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: 'DISQUALIFIED',
        disqualified: true,
        disqualifyReason: reason,
      },
    });
  }

  async pauseSession(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    // Store previous status so resume can restore it
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS' }, // keep status, pause is communicated via WS only
    });
  }

  async resumeSession(sessionId: string) {
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS' },
    });
  }

  async getDashboardStats(organizationId?: string) {
    const where: any = organizationId ? { organizationId } : {};
    const [total, thisMonth, live, pendingReview] = await Promise.all([
      this.prisma.examSession.count({ where }),
      this.prisma.examSession.count({
        where: {
          ...where,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.examSession.count({
        where: { ...where, status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'] } },
      }),
      this.prisma.examSession.count({
        where: { ...where, status: 'PENDING_PROCTOR_REVIEW' },
      }),
    ]);
    return { total, thisMonth, live, pendingReview };
  }
}
