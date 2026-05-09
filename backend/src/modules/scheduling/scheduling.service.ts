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
    );

    return session;
  }
}
