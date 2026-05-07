import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSessions, sessionsThisMonth, liveSessions, pendingReports,
      totalOrgs, totalUsers, totalCandidates, publishedReports,
    ] = await Promise.all([
      this.prisma.examSession.count(),
      this.prisma.examSession.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.examSession.count({ where: { status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'] } } }),
      this.prisma.examSession.count({ where: { status: 'PENDING_PROCTOR_REVIEW' } }),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.candidateRecord.count(),
      this.prisma.report.count({ where: { status: 'PUBLISHED' } }),
    ]);

    // Pass rate
    const passedReports = await this.prisma.report.count({ where: { status: 'PUBLISHED', overallPassed: true } });
    const passRate = publishedReports > 0 ? Math.round((passedReports / publishedReports) * 100) : 0;

    return {
      totalSessions, sessionsThisMonth, liveSessions, pendingReports,
      totalOrgs, totalUsers, totalCandidates, passRate,
    };
  }

  async getActivityData(range: string, organizationId?: string, assessmentTypeId?: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '3m' ? 90 : 365;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where: any = { createdAt: { gte: from } };
    if (organizationId) where.organizationId = organizationId;
    if (assessmentTypeId) where.assessmentTypeId = assessmentTypeId;

    const sessions = await this.prisma.examSession.findMany({
      where,
      select: { createdAt: true, status: true },
    });

    // Group by date
    const grouped: Record<string, { scheduled: number; completed: number; pending: number; noShow: number }> = {};
    sessions.forEach(s => {
      const date = s.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { scheduled: 0, completed: 0, pending: 0, noShow: 0 };
      if (s.status === 'SCHEDULED') grouped[date].scheduled++;
      else if (s.status === 'REPORT_PUBLISHED') grouped[date].completed++;
      else if (s.status === 'PENDING_PROCTOR_REVIEW') grouped[date].pending++;
      else if (s.status === 'NO_SHOW') grouped[date].noShow++;
    });

    return Object.entries(grouped).map(([date, counts]) => ({ date, ...counts }));
  }

  async getSettings() {
    const settings = await this.prisma.platformSettings.findMany();
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  async updateSettings(key: string, value: any, updatedBy: string) {
    return this.prisma.platformSettings.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  async getAuditLog(filters?: any) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.eventType) where.eventType = filters.eventType;
    if (filters?.from) where.createdAt = { gte: new Date(filters.from) };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(filters?.limit) || 100,
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  async writeAuditLog(data: {
    userId: string;
    userEmail: string;
    role: string;
    eventType: string;
    target?: string;
    targetId?: string;
    payload?: any;
    ipAddress: string;
  }) {
    // Get last entry for chain hash
    const last = await this.prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    const prevHash = last?.chainHash || '0000000000000000';
    const content = JSON.stringify({ ...data, prevHash, timestamp: new Date().toISOString() });
    const chainHash = crypto.createHash('sha256').update(content).digest('hex');

    return this.prisma.auditLog.create({
      data: { ...data, chainHash },
    });
  }

  async addReportComment(reportId: string, comment: string, type: string, adminId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    const existing = (report?.masterProctorReview as any) || {};
    const comments = existing.adminComments || [];
    comments.push({ comment, type, adminId, createdAt: new Date().toISOString() });

    return this.prisma.report.update({
      where: { id: reportId },
      data: { masterProctorReview: { ...existing, adminComments: comments } },
    });
  }
}
