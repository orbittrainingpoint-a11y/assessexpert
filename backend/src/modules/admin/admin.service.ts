import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

// Per-setting validation rules. Keys not listed here are accepted as-is
// (booleans for feature flags, free-text legal content, etc.). This
// matches the labels in the admin settings UI so a typo'd value is
// rejected at the API instead of silently saved.
const NUMERIC_SETTING_BOUNDS: Record<string, { min: number; max: number; integer?: boolean }> = {
  recording_retention_days:           { min: 1,   max: 3650, integer: true },
  fr_image_retention_days:            { min: 1,   max: 3650, integer: true },
  max_concurrent_sessions:            { min: 1,   max: 10000, integer: true },
  fr_similarity_threshold_verified:   { min: 0,   max: 100 },
  fr_similarity_threshold_review:     { min: 0,   max: 100 },
  fr_check_interval_seconds:          { min: 5,   max: 3600, integer: true },
  face_absence_threshold_seconds:     { min: 1,   max: 300,  integer: true },
  tab_switch_escalation_count:        { min: 1,   max: 50,   integer: true },
  min_proctor_narrative_chars:        { min: 0,   max: 10000, integer: true },
  report_sla_hours:                   { min: 1,   max: 168,  integer: true },
};

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

    // Aggregate in the database with date_trunc + filtered counts instead
    // of loading every session row into Node and grouping in JS. The old
    // approach pulled the full result set into memory — fine for a small
    // org, an OOM risk for a busy tenant over a 1-year range.
    const rows = await this.prisma.$queryRaw<Array<{
      date: Date; scheduled: bigint; completed: bigint; pending: bigint; noshow: bigint;
    }>>`
      SELECT
        date_trunc('day', "createdAt") AS date,
        COUNT(*) FILTER (WHERE "status" = 'SCHEDULED')               AS scheduled,
        COUNT(*) FILTER (WHERE "status" = 'REPORT_PUBLISHED')        AS completed,
        COUNT(*) FILTER (WHERE "status" = 'PENDING_PROCTOR_REVIEW')  AS pending,
        COUNT(*) FILTER (WHERE "status" = 'NO_SHOW')                 AS noshow
      FROM "ExamSession"
      WHERE "createdAt" >= ${from}
        ${organizationId ? Prisma.sql`AND "organizationId" = ${organizationId}` : Prisma.empty}
        ${assessmentTypeId ? Prisma.sql`AND "assessmentTypeId" = ${assessmentTypeId}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      scheduled: Number(r.scheduled),
      completed: Number(r.completed),
      pending: Number(r.pending),
      noShow: Number(r.noshow),
    }));
  }

  async getSettings() {
    const settings = await this.prisma.platformSettings.findMany();
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  async updateSettings(key: string, value: any, updatedBy: string) {
    // Reject out-of-bounds numeric settings before they hit the DB so a
    // typo in the admin UI (e.g. retention=-5 or threshold=999%) can't
    // brick downstream code that expects sane values.
    const bound = NUMERIC_SETTING_BOUNDS[key];
    if (bound) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new BadRequestException(`${key} must be a number`);
      }
      if (n < bound.min || n > bound.max) {
        throw new BadRequestException(`${key} must be between ${bound.min} and ${bound.max}`);
      }
      if (bound.integer && !Number.isInteger(n)) {
        throw new BadRequestException(`${key} must be an integer`);
      }
      value = n;
    }
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
        take: Math.min(parseInt(filters?.limit) || 100, 1000),
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
    // Tamper-evidence relies on the chain being a true linked list.
    // The old code did `findFirst` then `create` outside any transaction
    // — two concurrent writers could read the same prevHash and both
    // write children of the same node, forking the chain silently. We
    // now wrap the read+write in a Serializable transaction so Postgres
    // refuses to commit one of them on conflict; the loser is retried
    // by Prisma's serialization-failure handler in the next attempt.
    // This is intentionally not lock-free — audit volume is low and
    // serialization correctness is the whole point of having a chain.
    return this.prisma.$transaction(
      async tx => {
        const last = await tx.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
        const prevHash = last?.chainHash || '0000000000000000';
        const content = JSON.stringify({ ...data, prevHash, timestamp: new Date().toISOString() });
        const chainHash = crypto.createHash('sha256').update(content).digest('hex');
        return tx.auditLog.create({ data: { ...data, chainHash } });
      },
      { isolationLevel: 'Serializable' },
    );
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
