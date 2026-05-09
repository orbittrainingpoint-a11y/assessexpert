import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);
  
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
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
    const token = randomBytes(32).toString('hex');
    // Token valid from 15 minutes before scheduled time until 15 minutes after
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 15 * 60 * 1000);

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
            <p><strong>${session.assessmentType.name}</strong><br/>${data.scheduledAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Dubai' })} (Asia/Dubai)</p>
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
