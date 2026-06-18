import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FacialRecognitionService } from '../facial-recognition/facial-recognition.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  // In-memory presence map: interviewId → lastSeenAt (ms).
  // Bumped on every getByToken call (candidate browser polls the interview
  // record every 8s on their join page, so this gets touched frequently
  // while the candidate is in front of the screen). Survives until the
  // backend restarts — that's fine, presence is ephemeral by definition.
  private readonly presence = new Map<string, number>();
  private readonly PRESENCE_TTL_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    private fr: FacialRecognitionService,
    private notifications: NotificationsService,
  ) {}

  // ── Schedule / list / fetch ───────────────────────────────────────────

  async schedule(data: {
    candidateId: string;
    sessionId?: string;
    organizationId: string;
    scheduledAt: Date;
    format?: string;
    notes?: string;
    interviewers?: string[];
    scheduledBy: string;
  }) {
    if (!data.candidateId) throw new BadRequestException('candidateId is required');
    // Tenant safety: a candidate from a different org shouldn't be
    // schedulable from this caller's tenant. Pull the fields we need for
    // the invitation email at the same time so we don't double-query.
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id: data.candidateId },
      select: { id: true, organizationId: true, email: true, firstName: true, lastName: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.organizationId !== data.organizationId) {
      throw new BadRequestException('Candidate does not belong to this organization');
    }

    const magicToken = randomBytes(32).toString('hex');
    // Link valid from now until 24h AFTER the scheduled time — gives the
    // candidate room to join late and lets HR reschedule a short slot
    // without burning the link.
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 24 * 60 * 60 * 1000);

    const interview = await this.prisma.interview.create({
      data: {
        candidateId: data.candidateId,
        sessionId: data.sessionId ?? null,
        organizationId: data.organizationId,
        scheduledAt: data.scheduledAt,
        format: data.format || 'VIDEO',
        notes: data.notes ?? null,
        interviewers: data.interviewers || [],
        status: 'SCHEDULED',
        scheduledBy: data.scheduledBy,
        magicToken,
        tokenExpiresAt,
      },
    });

    // Best-effort candidate invitation. Email failures shouldn't bubble
    // up — the magic link is still copyable from the HR list, and the
    // NotificationsService logs+counts failures for the admin health view.
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.organizationId },
        select: { name: true, tradingName: true, logo: true, timezone: true, brandingConfig: true },
      });
      const baseUrl = process.env.FRONTEND_URL
        || (process.env.FRONTEND_URLS || '').split(',')[0]
        || 'http://localhost:3000';
      const magicLink = `${baseUrl.replace(/\/$/, '')}/interview/${magicToken}`;
      await this.notifications.sendInterviewInvitation(
        candidate.email,
        `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        {
          companyName: org?.name || 'Your assessor',
          scheduledAt: data.scheduledAt,
          timezone: org?.timezone || 'Asia/Dubai',
          magicLink,
          notes: data.notes,
          branding: org ? {
            displayName: org.tradingName || org.name,
            logoUrl: org.logo,
            brandColor: (org.brandingConfig as any)?.brandColor || null,
          } : null,
        },
      );
    } catch (err: any) {
      this.logger.error(`Interview invite email failed for ${candidate.email}: ${err?.message || err}`);
    }

    return interview;
  }

  getAll(filters: { organizationId?: string; status?: string; candidateId?: string; limit?: number }) {
    const where: any = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.status) where.status = filters.status;
    if (filters.candidateId) where.candidateId = filters.candidateId;
    return this.prisma.interview.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: Math.min(Number(filters.limit) || 50, 200),
    });
  }

  async getOne(id: string) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────

  async start(id: string) {
    await this.getOne(id);
    return this.prisma.interview.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async end(id: string, body: { impression?: string; recommendation?: string; notes?: string; verdict?: string }) {
    await this.getOne(id);
    return this.prisma.interview.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        impression: body?.impression ?? null,
        recommendation: body?.recommendation ?? null,
        verdict: body?.verdict ?? null,
        notes: body?.notes ?? undefined,
      },
    });
  }

  async cancel(id: string) {
    await this.getOne(id);
    return this.prisma.interview.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Move a scheduled interview to a new time. Reuses the same magicToken
   * so the candidate's existing link still works — we just push out the
   * expiry to match the new slot. Best-effort re-sends the invite email
   * with the new time so the candidate isn't confused.
   *
   * Only SCHEDULED interviews can be rescheduled. IN_PROGRESS / COMPLETED
   * / CANCELLED must be re-created from scratch (matches the exam-side
   * reschedule policy).
   */
  async reschedule(id: string, newScheduledAt: Date) {
    const existing = await this.getOne(id);
    if (existing.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot reschedule an interview with status ${existing.status} — only SCHEDULED interviews are rescheduleable.`,
      );
    }
    const tokenExpiresAt = new Date(newScheduledAt.getTime() + 24 * 60 * 60 * 1000);
    const updated = await this.prisma.interview.update({
      where: { id },
      data: { scheduledAt: newScheduledAt, tokenExpiresAt },
    });

    // Best-effort reschedule email — same shape as the original invite.
    try {
      const candidate = await this.prisma.candidateRecord.findUnique({
        where: { id: existing.candidateId },
        select: { email: true, firstName: true, lastName: true, organizationId: true },
      });
      if (candidate) {
        const org = await this.prisma.organization.findUnique({
          where: { id: candidate.organizationId },
          select: { name: true, tradingName: true, logo: true, timezone: true, brandingConfig: true },
        });
        const baseUrl = process.env.FRONTEND_URL
          || (process.env.FRONTEND_URLS || '').split(',')[0]
          || 'http://localhost:3000';
        const magicLink = `${baseUrl.replace(/\/$/, '')}/interview/${existing.magicToken}`;
        await this.notifications.sendInterviewInvitation(
          candidate.email,
          `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
          {
            companyName: org?.name || 'Your assessor',
            scheduledAt: newScheduledAt,
            timezone: org?.timezone || 'Asia/Dubai',
            magicLink,
            notes: existing.notes ?? null,
            branding: org ? {
              displayName: org.tradingName || org.name,
              logoUrl: org.logo,
              brandColor: (org.brandingConfig as any)?.brandColor || null,
            } : null,
          },
        );
      }
    } catch (err: any) {
      this.logger.error(`Interview reschedule email failed: ${err?.message || err}`);
    }

    return updated;
  }

  // ── Identity verification during the interview ────────────────────────

  /**
   * Compares a live frame captured on HR's browser against the candidate's
   * stored reference photo (the one captured during exam verification).
   * Persists the latest verdict on the interview row so HR sees the most
   * recent check at a glance. Best-effort — a missing reference photo
   * surfaces a clear PENDING_REVIEW outcome instead of a 500.
   */
  async verifyFrame(id: string, capturedImageBase64?: string) {
    if (!capturedImageBase64) throw new BadRequestException('capturedImage is required');
    const interview = await this.getOne(id);
    const result = await this.fr.compareAgainstReference(interview.candidateId, capturedImageBase64);
    await this.prisma.interview.update({
      where: { id },
      data: {
        frSimilarity: result.similarity,
        frVerdict: result.outcome,
        frCheckedAt: new Date(),
      },
    });
    return { similarity: result.similarity, outcome: result.outcome, reason: result.reason };
  }

  async manualVerify(id: string, verified: boolean, note?: string) {
    await this.getOne(id);
    return this.prisma.interview.update({
      where: { id },
      data: {
        manualVerified: verified,
        manualVerifyNote: note ?? null,
      },
    });
  }

  // ── Candidate-side join (token-gated, no JWT) ─────────────────────────

  async getByToken(token: string) {
    if (!token) throw new BadRequestException('token is required');
    const interview = await this.prisma.interview.findUnique({
      where: { magicToken: token },
      // Don't leak the magic token back out to the client.
      select: {
        id: true, scheduledAt: true, format: true, status: true,
        candidateId: true, organizationId: true, sessionId: true,
        tokenExpiresAt: true,
      },
    });
    if (!interview) throw new NotFoundException('Invalid interview link');
    if (interview.tokenExpiresAt < new Date()) throw new BadRequestException('Interview link has expired');
    // Mark candidate as currently present in the room. HR's interview list
    // polls /interviews/presence to render a "candidate waiting" indicator
    // before they open the room.
    this.presence.set(interview.id, Date.now());
    return interview;
  }

  /** Returns interview ids whose candidate browser polled inside the TTL. */
  async getActivePresence(organizationId: string): Promise<string[]> {
    const cutoff = Date.now() - this.PRESENCE_TTL_MS;
    const fresh: string[] = [];
    for (const [id, ts] of this.presence) {
      if (ts >= cutoff) fresh.push(id);
      else this.presence.delete(id);
    }
    if (fresh.length === 0) return [];
    // Filter to interviews owned by this org. The presence map is global
    // because it's a fast O(1) read, but the response must respect tenancy.
    const rows = await this.prisma.interview.findMany({
      where: { id: { in: fresh }, organizationId },
      select: { id: true },
    });
    return rows.map(r => r.id);
  }
}
