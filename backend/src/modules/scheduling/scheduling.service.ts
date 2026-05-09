import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SchedulingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getAvailableSlots(assessmentTypeId: string, dateFrom: string, dateTo: string) {
    // Get available proctors certified for this assessment type
    const proctors = await this.prisma.user.findMany({
      where: { role: 'PROCTOR', status: 'ACTIVE' },
    });

    // Generate available slots (simplified - in production would check proctor availability table)
    const slots = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) { // Skip weekends
        for (const hour of [9, 10, 11, 14, 15, 16]) {
          const slotTime = new Date(d);
          slotTime.setHours(hour, 0, 0, 0);
          if (slotTime > new Date()) {
            slots.push({
              datetime: slotTime.toISOString(),
              available: true,
              proctorCount: proctors.length,
            });
          }
        }
      }
    }

    return slots.slice(0, 10); // Return first 10 available slots
  }

  async scheduleSession(data: {
    candidateId: string;
    assessmentTypeId: string;
    organizationId: string;
    scheduledAt: Date;
    proctorId?: string;
  }) {
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 30 * 60 * 1000);

    // Auto-assign proctor if not specified
    let proctorId = data.proctorId;
    if (!proctorId) {
      const proctor = await this.prisma.user.findFirst({
        where: { role: 'PROCTOR', status: 'ACTIVE' },
      });
      proctorId = proctor?.id;
    }

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

    // Send invitation email to candidate
    const magicLink = `${process.env.FRONTEND_URL}/exam?token=${token}`;
    await this.notifications.sendCandidateInvitation(
      session.candidate.email,
      `${session.candidate.firstName} ${session.candidate.lastName}`,
      {
        companyName: (session as any).organization?.name || 'AssessExpert',
        assessmentName: session.assessmentType.name,
        scheduledAt: data.scheduledAt,
        timezone: 'Asia/Dubai',
        magicLink,
      },
    ).catch(() => {});

    // Schedule 24h reminder
    const remind24h = new Date(data.scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    if (remind24h > new Date()) {
      const delay24h = remind24h.getTime() - Date.now();
      setTimeout(() => {
        this.notifications.sendEmail(
          session.candidate.email,
          `Reminder: Your Assessment Tomorrow — ${session.assessmentType.name}`,
          `<div style="font-family:Inter,sans-serif;background:#060B18;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto">
            <h1 style="color:#00D4FF">assessexpert</h1>
            <h2>Assessment Reminder — 24 Hours</h2>
            <p>Hi ${session.candidate.firstName},</p>
            <p>This is a reminder that your assessment is scheduled for tomorrow.</p>
            <p><strong>${session.assessmentType.name}</strong><br/>${data.scheduledAt.toLocaleString()} (Asia/Dubai)</p>
            <p>Ensure your camera, microphone, and internet connection are ready.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicLink}" style="background:#00D4FF;color:#060B18;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Access Your Exam</a>
            </div>
          </div>`,
        ).catch(() => {});
      }, delay24h);
    }

    // Schedule 1h reminder
    const remind1h = new Date(data.scheduledAt.getTime() - 60 * 60 * 1000);
    if (remind1h > new Date()) {
      const delay1h = remind1h.getTime() - Date.now();
      setTimeout(() => {
        this.notifications.sendEmail(
          session.candidate.email,
          `Starting in 1 Hour — ${session.assessmentType.name}`,
          `<div style="font-family:Inter,sans-serif;background:#060B18;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto">
            <h1 style="color:#00D4FF">assessexpert</h1>
            <h2>Your Assessment Starts in 1 Hour</h2>
            <p>Hi ${session.candidate.firstName},</p>
            <p>Your assessment begins in approximately 1 hour. Please prepare now.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicLink}" style="background:#00D4FF;color:#060B18;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Access Your Exam</a>
            </div>
          </div>`,
        ).catch(() => {});
      }, delay1h);
    }

    return session;
  }
}
