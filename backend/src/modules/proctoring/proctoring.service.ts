import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProctoringService {
  constructor(private prisma: PrismaService) {}

  async logEvent(sessionId: string, data: {
    eventType: string;
    severity: string;
    source: string;
    payload?: any;
    screenshotPath?: string;
  }) {
    return this.prisma.sessionEvent.create({
      data: {
        sessionId,
        eventType: data.eventType as any,
        severity: data.severity as any,
        source: data.source as any,
        payload: data.payload,
        screenshotPath: data.screenshotPath,
      },
    });
  }

  async getEvents(sessionId: string) {
    return this.prisma.sessionEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }

  async reviewFlag(eventId: string, outcome: string, proctorNote: string, proctorId: string) {
    return this.prisma.sessionEvent.update({
      where: { id: eventId },
      data: {
        reviewOutcome: outcome as any,
        proctorNote,
        reviewedBy: proctorId,
      },
    });
  }

  async sendWarning(sessionId: string, message: string, proctorId: string) {
    await this.logEvent(sessionId, {
      eventType: 'PROCTOR_WARNING',
      severity: 'WARNING',
      source: 'PROCTOR',
      payload: { message, sentBy: proctorId },
    });
    return { sent: true, message };
  }

  async getIntegrityScore(sessionId: string): Promise<number> {
    const events = await this.prisma.sessionEvent.findMany({ where: { sessionId } });
    const critical = events.filter(e => e.severity === 'CRITICAL').length;
    const warnings = events.filter(e => e.severity === 'WARNING').length;
    return Math.max(0, 100 - critical * 15 - warnings * 5);
  }

  async getAiFlagsThisWeek() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.prisma.sessionEvent.count({
      where: { source: 'AI', timestamp: { gte: weekAgo } },
    });
  }
}
