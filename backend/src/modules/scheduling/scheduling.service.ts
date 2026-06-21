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
    slotDurationMinutes?: number;
    // Quiz mode: MCQ-only, no camera/proctor. Defaults to PROCTORED so
    // every existing caller keeps current behaviour without changes.
    mode?: 'PROCTORED' | 'QUIZ';
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

    // Quiz mode is a super-admin opt-in per org. If the caller asks for
    // QUIZ but the org doesn't have the flag, refuse cleanly — same
    // message as the HR portal hides the option, so this should only
    // trigger from a hand-crafted API call or a stale frontend bundle.
    if (data.mode === 'QUIZ') {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.organizationId },
        select: { quizEnabled: true },
      });
      if (!org?.quizEnabled) {
        throw new BadRequestException(
          'Quiz mode is not enabled for this organization. Ask the platform admin to enable it under Companies → Features.',
        );
      }
    }

    // QUIZ mode is self-administered — no camera, no proctor, no slot.
    // Skip proctor auto-assignment (a quiz session with a proctor
    // attached would show up in proctor queues, which is the bug HR
    // hit). Same for slot grouping below — slot grouping is a
    // proctor-window optimisation that's meaningless when there's no
    // proctor. Quiz tokens get a much longer validity window so the
    // candidate can take the quiz whenever it suits them.
    const isQuiz = data.mode === 'QUIZ';

    // Auto-assign proctor only for proctored sessions.
    let proctorId = data.proctorId;
    if (!isQuiz && !proctorId) {
      const proctor = await this.prisma.user.findFirst({
        where: { role: 'PROCTOR', status: 'ACTIVE' },
      });
      proctorId = proctor?.id;
    }
    if (isQuiz) proctorId = undefined;

    // Slot grouping: a "slot" is a time WINDOW (slotDurationMinutes, default
    // 60). When a candidate is scheduled with the same proctor + assessment +
    // org and their time overlaps an existing SCHEDULED slot's window, we add
    // them to that ONE session instead of spawning a duplicate. All candidates
    // in the slot then share one magic link and one proctor multi-candidate
    // screen. (Previously this only merged within a ±60-second window, so
    // siblings scheduled minutes apart wrongly became separate sessions —
    // which is exactly why each candidate landed on a separate proctor screen
    // and a re-schedule produced a second link.)
    const slotDurationMinutes =
      Number(data.slotDurationMinutes) > 0 ? Math.round(Number(data.slotDurationMinutes)) : 60;
    if (!isQuiz && proctorId) {
      const newStart = data.scheduledAt.getTime();
      const newEnd = newStart + slotDurationMinutes * 60_000;
      // Bound the scan to ±6h around the request so we don't read the whole
      // table, then test true window overlap in JS (Prisma can't express the
      // computed slot end — scheduledAt + duration — in a where clause).
      const SEARCH_BOUND_MS = 6 * 60 * 60_000;
      const candidateSlots = await this.prisma.examSession.findMany({
        where: {
          assessmentTypeId: data.assessmentTypeId,
          organizationId: data.organizationId,
          proctorId,
          status: 'SCHEDULED',
          scheduledAt: {
            gte: new Date(newStart - SEARCH_BOUND_MS),
            lte: new Date(newEnd + SEARCH_BOUND_MS),
          },
        },
        orderBy: { scheduledAt: 'asc' },
        include: { candidate: true, assessmentType: true, organization: true, sessionCandidates: true },
      });
      // First overlapping slot wins (earliest start, thanks to orderBy).
      const existingSlot = candidateSlots.find(s => {
        const sStart = new Date(s.scheduledAt).getTime();
        const sEnd = sStart + ((s as any).slotDurationMinutes || 60) * 60_000;
        return newStart < sEnd && sStart < newEnd;
      });

      const alreadyIn =
        existingSlot &&
        (existingSlot.candidateId === data.candidateId ||
          existingSlot.sessionCandidates.some(sc => sc.candidateId === data.candidateId));

      // Idempotent re-schedule: the candidate is ALREADY in this slot. Do not
      // create a duplicate session or send a second link — just return the
      // slot so the HR UI reflects it. This kills the "schedule again →
      // second link" bug.
      if (existingSlot && alreadyIn) {
        const slot = await this.prisma.examSession.findUnique({
          where: { id: existingSlot.id },
          include: { candidate: true, assessmentType: true, organization: true, sessionCandidates: { include: { candidate: true } } },
        });
        return { ...(slot as any), invitationSent: false, alreadyScheduled: true };
      }

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
                timezone: (existingSlot as any).organization?.timezone || 'Asia/Dubai',
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
    // Token validity window:
    //   - PROCTORED: tight ±15min around scheduledAt (matches the
    //     proctor's live slot — late candidates miss the session).
    //   - QUIZ: long window so the candidate can take it whenever
    //     suits them. Defaults to 14 days; configurable via the
    //     QUIZ_TOKEN_VALIDITY_DAYS env var.
    const quizDays = Number(process.env.QUIZ_TOKEN_VALIDITY_DAYS) > 0
      ? Number(process.env.QUIZ_TOKEN_VALIDITY_DAYS)
      : 14;
    const tokenExpiresAt = isQuiz
      ? new Date(data.scheduledAt.getTime() + quizDays * 24 * 60 * 60 * 1000)
      : new Date(data.scheduledAt.getTime() + 15 * 60 * 1000);

    // Every new session is created as multi-candidate (with N=1 for the
    // moment) so the proctor + candidate UIs only ever need one rendering
    // path. A SessionCandidate row is created for the primary candidate
    // at the same time — every subsequent backend lookup uses that row
    // as the source of truth instead of branching on a boolean.
    const session = await this.prisma.examSession.create({
      data: {
        candidateId: data.candidateId,
        assessmentTypeId: data.assessmentTypeId,
        organizationId: data.organizationId,
        proctorId,
        scheduledAt: data.scheduledAt,
        slotDurationMinutes,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
        mode: data.mode || 'PROCTORED',
        isMultiCandidate: true,
        sessionCandidates: {
          create: [{ candidateId: data.candidateId, status: 'PENDING' as any }],
        },
      },
      include: { candidate: true, assessmentType: true, organization: true },
    });

    // Send invitation email to candidate. We AWAIT this (so the HR user
    // sees a real outcome — sent / not sent — before the API returns)
    // but capture the result instead of swallowing errors. The old
    // .catch(() => {}) made every flaky SMTP attempt look successful and
    // is exactly why the user was seeing "scheduled but no email
    // arrived, works on retry" behaviour.
    // Quiz mode lands on /quiz/<token>; proctored exam uses /exam?token=…
    // `isQuiz` was declared earlier (line ~163) to gate proctor
    // assignment and slot grouping — reuse it here.
    const magicLink = isQuiz
      ? `${process.env.FRONTEND_URL}/quiz/${token}`
      : `${process.env.FRONTEND_URL}/exam?token=${token}`;
    const orgTimezone = (session as any).organization?.timezone || 'Asia/Dubai';
    let invitationResult: { sent: boolean; error?: string };
    try {
      const r = await this.notifications.sendCandidateInvitation(
        session.candidate.email,
        `${session.candidate.firstName} ${session.candidate.lastName}`,
        {
          companyName: (session as any).organization?.name || 'AssessExpert',
          assessmentName: session.assessmentType.name,
          scheduledAt: data.scheduledAt,
          timezone: orgTimezone,
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
            <p><strong>${session.assessmentType.name}</strong><br/>${data.scheduledAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: orgTimezone })} (${orgTimezone})</p>
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
    // Only sessions that haven't actually been taken yet can be moved.
    // CHECKLIST = candidate opened the magic link and entered the pre-exam
    // verification phase but never reached the MCQ — typical when hardware
    // (camera, mic) failed verification. HR legitimately wants to reschedule
    // these. EXPIRED / NO_SHOW are also pre-MCQ states, also rescheduleable.
    const ALLOWED = ['SCHEDULED', 'INVITED', 'CHECKLIST', 'NO_SHOW', 'EXPIRED'];
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

    // Re-send the invitation with the new time + link. Also include a
    // clear "your session has been rescheduled" line in the subject —
    // before, the candidate received a second invitation email with no
    // hint that it was a reschedule, easy to mistake for a duplicate.
    const magicLink = `${process.env.FRONTEND_URL}/exam?token=${token}`;
    const orgTimezone = (updated as any).organization?.timezone || 'Asia/Dubai';
    let rescheduleResult: { sent: boolean; error?: string } = { sent: false };
    try {
      const r = await this.notifications.sendRescheduleNotice(
        updated.candidate.email,
        `${updated.candidate.firstName} ${updated.candidate.lastName}`,
        {
          companyName: (updated as any).organization?.name || 'AssessExpert',
          assessmentName: updated.assessmentType.name,
          scheduledAt: newScheduledAt,
          timezone: orgTimezone,
          magicLink,
        },
      );
      rescheduleResult = { sent: !!(r as any)?.sent, error: (r as any)?.error };
    } catch (e: any) {
      rescheduleResult = { sent: false, error: e?.message || String(e) };
      this.logger.warn(`Reschedule notice failed for ${updated.candidate.email}: ${e?.message || e}`);
    }

    return {
      ...(updated as any),
      rescheduleNoticeSent: rescheduleResult.sent,
      rescheduleNoticeError: rescheduleResult.error,
    };
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
