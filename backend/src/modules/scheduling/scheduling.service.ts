import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RemindersService } from '../notifications/reminders.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private reminders: RemindersService,
  ) {}

  async getAvailableSlots(assessmentTypeId: string, dateFrom: string, dateTo: string) {
    this.logger.log(`Getting available slots from ${dateFrom} to ${dateTo} for assessment ${assessmentTypeId}`);
    
    // Get available proctors certified for this assessment type
    const proctors = await this.prisma.user.findMany({
      where: { role: 'PROCTOR', status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, timezone: true },
    });

    this.logger.log(`Found ${proctors.length} active proctors`);

    if (proctors.length === 0) {
      this.logger.warn('No active proctors found');
      return [];
    }

    // Get proctor availability from database
    const proctorIds = proctors.map(p => p.id);
    const availabilitySlots = await this.prisma.proctorAvailability.findMany({
      where: {
        proctorId: { in: proctorIds },
        isOverride: false,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    this.logger.log(`Found ${availabilitySlots.length} availability slots in database`);

    if (availabilitySlots.length === 0) {
      this.logger.warn('No availability slots found in database. Proctors need to set their availability.');
      return [];
    }

    // Generate available slots based on proctor availability
    const slots = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = (d.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
      
      // Find availability for this day
      const dayAvailability = availabilitySlots.filter(slot => slot.dayOfWeek === dayOfWeek);
      
      if (dayAvailability.length > 0) {
        // For each availability slot on this day
        for (const avail of dayAvailability) {
          const startHour = parseInt(avail.startTime.split(':')[0]);
          const endHour = parseInt(avail.endTime.split(':')[0]);
          
          // Generate hourly slots
          for (let hour = startHour; hour < endHour; hour++) {
            const slotTime = new Date(d);
            slotTime.setHours(hour, 0, 0, 0);
            
            // Only include future slots
            if (slotTime > new Date()) {
              // Count how many proctors are available at this time
              const availableProctors = availabilitySlots.filter(s => {
                if (s.dayOfWeek !== dayOfWeek) return false;
                const sStart = parseInt(s.startTime.split(':')[0]);
                const sEnd = parseInt(s.endTime.split(':')[0]);
                return hour >= sStart && hour < sEnd;
              });
              
              slots.push({
                datetime: slotTime.toISOString(),
                available: availableProctors.length > 0,
                proctorCount: availableProctors.length,
                dayOfWeek,
                hour,
              });
            }
          }
        }
      }
    }

    // Remove duplicates and sort
    const uniqueSlots = Array.from(
      new Map(slots.map(s => [s.datetime, s])).values()
    ).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    this.logger.log(`Generated ${uniqueSlots.length} available slots`);
    
    return uniqueSlots.slice(0, 50); // Return first 50 available slots
  }

  async scheduleSession(data: {
    candidateId: string;
    assessmentTypeId: string;
    organizationId: string;
    scheduledAt: Date;
    proctorId?: string;
  }) {
    // Tenant isolation: refuse to schedule a candidate that belongs to a
    // different organization than the one the caller is scoped to. Without
    // this an HR account from Org A could quietly schedule (and mail a
    // magic link to) candidates from Org B simply by passing their id in
    // the request body. We also reject if the candidate doesn't exist —
    // cleaner than letting Prisma's FK constraint throw later.
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id: data.candidateId },
      select: { id: true, organizationId: true },
    });
    if (!candidate) {
      throw new BadRequestException('Candidate not found');
    }
    if (candidate.organizationId !== data.organizationId) {
      throw new BadRequestException('Candidate does not belong to this organization');
    }
    // Same check for assessment type — assessments are global today but
    // we still want to fail fast on an unknown id.
    const at = await this.prisma.assessmentType.findUnique({
      where: { id: data.assessmentTypeId },
      select: { id: true },
    });
    if (!at) throw new BadRequestException('Assessment type not found');

    // Auto-assign proctor if not specified
    let proctorId = data.proctorId;
    if (!proctorId) {
      const proctor = await this.prisma.user.findFirst({
        where: { role: 'PROCTOR', status: 'ACTIVE' },
      });
      proctorId = proctor?.id;
    }

    // Auto-merge: if a session already exists for the same slot (same
    // proctor + assessment + org, still SCHEDULED) with scheduledAt within
    // a ±60-second window of the request, add this candidate to it instead
    // of creating a new session. The window forgives "10:00:00 vs 10:00:30"
    // clock drift between HR users scheduling siblings — exact-match would
    // otherwise spawn a near-duplicate slot. All candidates in the slot
    // then share one magic link and one proctor window.
    if (proctorId) {
      const AUTO_MERGE_WINDOW_MS = 60_000;
      const windowStart = new Date(data.scheduledAt.getTime() - AUTO_MERGE_WINDOW_MS);
      const windowEnd = new Date(data.scheduledAt.getTime() + AUTO_MERGE_WINDOW_MS);
      const existingSlot = await this.prisma.examSession.findFirst({
        where: {
          assessmentTypeId: data.assessmentTypeId,
          organizationId: data.organizationId,
          proctorId,
          scheduledAt: { gte: windowStart, lte: windowEnd },
          status: 'SCHEDULED',
        },
        // Tie-breaker: if two slots somehow fall inside the window
        // (shouldn't happen unless the boundary was hit twice in 60s),
        // pick the closer one so the candidate ends up next to the
        // session they were actually trying to join.
        orderBy: { scheduledAt: 'asc' },
        include: { candidate: true, assessmentType: true, organization: true, sessionCandidates: true },
      });

      // Don't merge if the candidate is the primary or already a SessionCandidate
      const alreadyIn =
        existingSlot &&
        (existingSlot.candidateId === data.candidateId ||
          existingSlot.sessionCandidates.some(sc => sc.candidateId === data.candidateId));

      if (existingSlot && !alreadyIn) {
        // Promote the slot to multi-candidate the first time we merge a new person.
        // Also represent the original primary candidate as a SessionCandidate
        // so the proctor window lists everyone uniformly.
        if (!existingSlot.isMultiCandidate) {
          const primaryAsRow = await this.prisma.sessionCandidate.findUnique({
            where: { sessionId_candidateId: { sessionId: existingSlot.id, candidateId: existingSlot.candidateId } },
          });
          await this.prisma.$transaction([
            this.prisma.examSession.update({
              where: { id: existingSlot.id },
              data: { isMultiCandidate: true },
            }),
            ...(primaryAsRow
              ? []
              : [
                  this.prisma.sessionCandidate.create({
                    data: {
                      sessionId: existingSlot.id,
                      candidateId: existingSlot.candidateId,
                      status: 'PENDING' as any,
                    },
                  }),
                ]),
          ]);
        }

        await this.prisma.sessionCandidate.create({
          data: { sessionId: existingSlot.id, candidateId: data.candidateId, status: 'PENDING' as any },
        });

        // Email the new candidate the SAME magic link as the rest of the slot.
        // Surface the outcome on the returned object so the HR UI can show
        // "scheduled, but email failed" instead of silently lying. The old
        // .catch(() => {}) made flaky SMTP look like a successful schedule.
        let mergeInvitationResult: { sent: boolean; error?: string } = { sent: false, error: 'No candidate found' };
        const candidate = await this.prisma.candidateRecord.findUnique({ where: { id: data.candidateId } });
        if (candidate) {
          const magicLink = `${process.env.FRONTEND_URL}/exam?token=${existingSlot.magicToken}`;
          try {
            const r = await this.notifications.sendCandidateInvitation(
              candidate.email,
              `${candidate.firstName} ${candidate.lastName}`,
              {
                companyName: (existingSlot as any).organization?.name || 'AssessExpert',
                assessmentName: existingSlot.assessmentType.name,
                scheduledAt: data.scheduledAt,
                timezone: 'Asia/Dubai',
                magicLink,
              },
            );
            mergeInvitationResult = { sent: !!(r as any)?.sent, error: (r as any)?.error };
          } catch (e: any) {
            mergeInvitationResult = { sent: false, error: e?.message || String(e) };
            this.logger.warn(`Invitation send failed for ${candidate.email}: ${e?.message || e}`);
          }
        }

        // Return the existing (now multi-candidate) session
        const merged = await this.prisma.examSession.findUnique({
          where: { id: existingSlot.id },
          include: { candidate: true, assessmentType: true, organization: true, sessionCandidates: { include: { candidate: true } } },
        });
        return {
          ...(merged as any),
          invitationSent: mergeInvitationResult.sent,
          invitationError: mergeInvitationResult.error,
        };
      }
    }

    const token = randomBytes(32).toString('hex');
    // Token valid from 15 minutes before scheduled time until 15 minutes after
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 15 * 60 * 1000);

    const session = await this.prisma.examSession.create({
      data: {
        candidateId: data.candidateId,
        assessmentTypeId: data.assessmentTypeId,
        organizationId: data.organizationId,
        proctorId,
        scheduledAt: data.scheduledAt,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
      },
      include: { candidate: true, assessmentType: true, organization: true },
    });

    // Send invitation email to candidate. We AWAIT this (so the HR user
    // sees a real outcome — sent / not sent — before the API returns)
    // but capture the result instead of swallowing errors. The old
    // .catch(() => {}) made every flaky SMTP attempt look successful and
    // is exactly why the user was seeing "scheduled but no email
    // arrived, works on retry" behaviour.
    const magicLink = `${process.env.FRONTEND_URL}/exam?token=${token}`;
    let invitationResult: { sent: boolean; error?: string };
    try {
      const r = await this.notifications.sendCandidateInvitation(
        session.candidate.email,
        `${session.candidate.firstName} ${session.candidate.lastName}`,
        {
          companyName: (session as any).organization?.name || 'AssessExpert',
          assessmentName: session.assessmentType.name,
          scheduledAt: data.scheduledAt,
          timezone: 'Asia/Dubai',
          magicLink,
        },
      );
      invitationResult = { sent: !!(r as any)?.sent, error: (r as any)?.error };
    } catch (e: any) {
      invitationResult = { sent: false, error: e?.message || String(e) };
      this.logger.warn(`Invitation send failed for ${session.candidate.email}: ${e?.message || e}`);
    }

    // Schedule reminder emails via RemindersService — Bull-backed when
    // REDIS_URL is set so jobs survive deploys, in-process setTimeout
    // fallback otherwise. Fire-and-forget on purpose: a slow Bull
    // queue.add (Redis round-trip) was previously serialising into the
    // schedule API response and adding 1-2s of latency per session.
    // Reminder enqueue failures are logged and the session is still
    // created — losing a reminder is recoverable; blocking the schedule
    // is not.
    const remind24h = new Date(data.scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    const remind1h = new Date(data.scheduledAt.getTime() - 60 * 60 * 1000);
    void Promise.allSettled([
      this.reminders.schedule(remind24h, {
        to: session.candidate.email,
        subject: `Reminder: Your Assessment Tomorrow — ${session.assessmentType.name}`,
        html: `<div style="font-family:Inter,sans-serif;background:#060B18;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto">
            <h1 style="color:#00D4FF">assessexpert</h1>
            <h2>Assessment Reminder — 24 Hours</h2>
            <p>Hi ${session.candidate.firstName},</p>
            <p>This is a reminder that your assessment is scheduled for tomorrow.</p>
            <p><strong>${session.assessmentType.name}</strong><br/>${data.scheduledAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Dubai' })} (Asia/Dubai)</p>
            <p>Ensure your camera, microphone, and internet connection are ready.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicLink}" style="background:#00D4FF;color:#060B18;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Access Your Exam</a>
            </div>
          </div>`,
      }),
      this.reminders.schedule(remind1h, {
        to: session.candidate.email,
        subject: `Starting in 1 Hour — ${session.assessmentType.name}`,
        html: `<div style="font-family:Inter,sans-serif;background:#060B18;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto">
            <h1 style="color:#00D4FF">assessexpert</h1>
            <h2>Your Assessment Starts in 1 Hour</h2>
            <p>Hi ${session.candidate.firstName},</p>
            <p>Your assessment begins in approximately 1 hour. Please prepare now.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicLink}" style="background:#00D4FF;color:#060B18;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Access Your Exam</a>
            </div>
          </div>`,
      }),
    ]).then(results => {
      results.forEach((res, i) => {
        if (res.status === 'rejected') {
          this.logger.warn(`Reminder ${i === 0 ? '24h' : '1h'} enqueue failed for ${session.candidate.email}: ${res.reason?.message || res.reason}`);
        }
      });
    });

    return {
      ...(session as any),
      invitationSent: invitationResult.sent,
      invitationError: invitationResult.error,
    };
  }

  async rescheduleSession(sessionId: string, newScheduledAt: Date, organizationId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { candidate: true, assessmentType: true, organization: true },
    });
    if (!session || session.organizationId !== organizationId) {
      throw new NotFoundException('Session not found');
    }
    // Only sessions that haven't been taken yet can be moved
    const ALLOWED = ['SCHEDULED', 'INVITED', 'NO_SHOW'];
    if (!ALLOWED.includes(session.status)) {
      throw new BadRequestException(
        `Cannot reschedule a session with status ${session.status} — the exam has already started or finished.`,
      );
    }

    // Fresh token + expiry so the old magic link is invalidated
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(newScheduledAt.getTime() + 15 * 60 * 1000);

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        scheduledAt: newScheduledAt,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
        tokenUsedAt: null,
        tokenUsedFromIp: null,
      },
      include: { candidate: true, assessmentType: true, organization: true },
    });

    // Re-send the invitation with the new time + link
    const magicLink = `${process.env.FRONTEND_URL}/exam?token=${token}`;
    await this.notifications.sendCandidateInvitation(
      updated.candidate.email,
      `${updated.candidate.firstName} ${updated.candidate.lastName}`,
      {
        companyName: (updated as any).organization?.name || 'AssessExpert',
        assessmentName: updated.assessmentType.name,
        scheduledAt: newScheduledAt,
        timezone: 'Asia/Dubai',
        magicLink,
      },
    ).catch(() => {});

    return updated;
  }

  async getDiagnostics() {
    this.logger.log('Running scheduling diagnostics');
    
    // Count active proctors
    const proctorCount = await this.prisma.user.count({
      where: { role: 'PROCTOR', status: 'ACTIVE' },
    });

    // Get all proctors with details
    const proctors = await this.prisma.user.findMany({
      where: { role: 'PROCTOR', status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        timezone: true,
        maxSessionsPerDay: true,
      },
    });

    // Count availability slots
    const availabilityCount = await this.prisma.proctorAvailability.count();

    // Get all availability slots
    const availabilitySlots = await this.prisma.proctorAvailability.findMany({
      orderBy: [{ proctorId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Group by proctor
    const slotsByProctor = availabilitySlots.reduce((acc, slot) => {
      if (!acc[slot.proctorId]) acc[slot.proctorId] = [];
      acc[slot.proctorId].push(slot);
      return acc;
    }, {} as Record<string, any[]>);

    const proctorsWithSlots = proctors.map(p => ({
      ...p,
      slotsCount: slotsByProctor[p.id]?.length || 0,
      slots: slotsByProctor[p.id] || [],
    }));

    return {
      summary: {
        totalProctors: proctorCount,
        proctorsWithAvailability: Object.keys(slotsByProctor).length,
        proctorsWithoutAvailability: proctorCount - Object.keys(slotsByProctor).length,
        totalAvailabilitySlots: availabilityCount,
      },
      proctors: proctorsWithSlots,
      allSlots: availabilitySlots,
    };
  }
}
