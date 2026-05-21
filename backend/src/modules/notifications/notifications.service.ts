import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;
  // Counters for the recent failures — visible via /admin/email-health.
  // Kept in-memory because email failures are operational state, not
  // permanent records. Reset on process restart.
  private failureCount = 0;
  private lastFailures: Array<{ to: string; subject: string; error: string; at: string }> = [];

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn(`Email skipped (SMTP not configured) → ${to} | ${subject}`);
      this.recordFailure(to, subject, 'SMTP_USER/SMTP_PASS not set');
      return { sent: false, error: 'SMTP not configured' };
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@assessexpert.ae',
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent → ${to} | ${subject} | id=${info.messageId}`);
      return { sent: true, messageId: info.messageId };
    } catch (e: any) {
      // Loud, structured failure — pm2/journalctl picks this up so the
      // operator can grep email-send issues. Also kept in memory for
      // the admin health endpoint.
      this.logger.error(
        `EMAIL FAILED → ${to} | ${subject} | ${e?.message || e}`,
        e?.stack,
      );
      this.recordFailure(to, subject, e?.message || String(e));
      return { sent: false, error: e?.message || String(e) };
    }
  }

  private recordFailure(to: string, subject: string, error: string) {
    this.failureCount++;
    this.lastFailures.unshift({ to, subject, error, at: new Date().toISOString() });
    if (this.lastFailures.length > 50) this.lastFailures.length = 50;
  }

  // Surfaced via the admin notification controller so the operator can see
  // recent SMTP failures without grepping logs.
  getEmailHealth() {
    return {
      smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      totalFailuresSinceStart: this.failureCount,
      recentFailures: this.lastFailures.slice(0, 25),
    };
  }

  async sendCandidateInvitation(candidateEmail: string, candidateName: string, data: {
    companyName: string;
    assessmentName: string;
    scheduledAt: Date;
    timezone: string;
    magicLink: string;
  }) {
    // Format date and time properly
    const dateOptions: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: data.timezone || 'Asia/Dubai'
    };
    const timeOptions: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      timeZone: data.timezone || 'Asia/Dubai'
    };
    
    const formattedDate = data.scheduledAt.toLocaleDateString('en-US', dateOptions);
    const formattedTime = data.scheduledAt.toLocaleTimeString('en-US', timeOptions);
    const formattedDateTime = `${formattedDate} at ${formattedTime} (${data.timezone || 'Asia/Dubai'})`;
    
    const html = `
      <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #00D4FF; font-size: 24px; margin: 0;">assessexpert</h1>
        </div>
        <h2 style="color: #F1F5F9;">Your Assessment is Scheduled</h2>
        <p>Hi ${candidateName},</p>
        <p>You have been scheduled for a technical assessment by <strong>${data.companyName}</strong>.</p>
        <table style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; width: 100%; margin: 20px 0;">
          <tr><td style="color: #94A3B8; padding: 8px 0;">Assessment:</td><td style="color: #F1F5F9;"><strong>${data.assessmentName}</strong></td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Date & Time:</td><td style="color: #F1F5F9;"><strong>${formattedDateTime}</strong></td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Duration:</td><td style="color: #F1F5F9;"><strong>Approximately 90 minutes</strong></td></tr>
        </table>
        <p style="color: #94A3B8;">Please ensure you have a working webcam, microphone, and stable internet connection.</p>
        <p style="color: #F59E0B; font-weight: 600;">⏰ You can join 15 minutes before the scheduled time.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.magicLink}" style="background: #00D4FF; color: #060B18; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Access Your Exam</a>
        </div>
        <p style="color: #475569; font-size: 12px;">Do not share this link. If you have issues, contact support@assessexpert.ae</p>
        <hr style="border-color: rgba(255,255,255,0.08); margin: 24px 0;">
        <p style="color: #475569; font-size: 12px; text-align: center;">assessexpert | Powered by Orbit Training · Dubai, UAE</p>
      </div>`;

    return this.sendEmail(candidateEmail, `Your Assessment is Scheduled — ${data.companyName} × assessexpert`, html);
  }

  async sendReportPublishedNotification(hrEmail: string, hrName: string, data: {
    candidateName: string;
    assessmentType: string;
    sessionDate: Date;
    overallResult: string;
    mcqScore: number;
    proctorName: string;
    dashboardUrl: string;
  }) {
    const html = `
      <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D4FF;">assessexpert</h1>
        <h2>Assessment Report Available</h2>
        <p>Hi ${hrName},</p>
        <p>The assessment report for <strong>${data.candidateName}</strong> has been published.</p>
        <table style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; width: 100%; margin: 20px 0;">
          <tr><td style="color: #94A3B8; padding: 8px 0;">Assessment:</td><td>${data.assessmentType}</td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Conducted:</td><td>${data.sessionDate.toLocaleDateString()}</td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Overall Result:</td><td><strong style="color: ${data.overallResult === 'PASS' ? '#059669' : '#E11D48'};">${data.overallResult}</strong></td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">MCQ Score:</td><td>${data.mcqScore.toFixed(1)}%</td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Proctor:</td><td>${data.proctorName}</td></tr>
        </table>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.dashboardUrl}" style="background: #00D4FF; color: #060B18; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Report in Dashboard</a>
        </div>
        <p style="color: #94A3B8; font-size: 13px;">This report includes the candidate's full question-by-question MCQ response breakdown.</p>
      </div>`;

    return this.sendEmail(hrEmail, `Assessment Report Available — ${data.candidateName}`, html);
  }

  // Notice sent to the candidate when their session is rescheduled. The
  // subject is explicit so it doesn't look like a duplicate invitation
  // — previously the candidate received a second "Your Assessment is
  // Scheduled" email with no hint that the time had changed.
  async sendRescheduleNotice(candidateEmail: string, candidateName: string, data: {
    companyName: string;
    assessmentName: string;
    scheduledAt: Date;
    timezone: string;
    magicLink: string;
  }) {
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: data.timezone || 'Asia/Dubai',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: data.timezone || 'Asia/Dubai',
    };
    const formattedDate = data.scheduledAt.toLocaleDateString('en-US', dateOptions);
    const formattedTime = data.scheduledAt.toLocaleTimeString('en-US', timeOptions);
    const formattedDateTime = `${formattedDate} at ${formattedTime} (${data.timezone})`;

    const html = `
      <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D4FF;">assessexpert</h1>
        <h2 style="color: #F59E0B;">Your Assessment Has Been Rescheduled</h2>
        <p>Hi ${candidateName},</p>
        <p>Your scheduled assessment with <strong>${data.companyName}</strong> has been moved to a new time.</p>
        <table style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 20px; width: 100%; margin: 20px 0;">
          <tr><td style="color: #94A3B8; padding: 8px 0;">Assessment:</td><td><strong>${data.assessmentName}</strong></td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">New Date & Time:</td><td><strong>${formattedDateTime}</strong></td></tr>
        </table>
        <p style="color: #94A3B8;">Your previous magic link is no longer valid — please use the new one below.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.magicLink}" style="background: #00D4FF; color: #060B18; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Access Your Exam</a>
        </div>
        <p style="color: #475569; font-size: 12px;">If you have questions about this change, contact your hiring coordinator.</p>
      </div>`;
    return this.sendEmail(candidateEmail, `Rescheduled: ${data.assessmentName} — ${data.companyName}`, html);
  }

  // Notice sent to the candidate when the proctor publishes their
  // report. Some customers prefer to send results themselves; the
  // `allowCandidateReportEmail` org flag (read by the caller) decides
  // whether this fires.
  async sendCandidateReportNotice(candidateEmail: string, candidateName: string, data: {
    companyName: string;
    assessmentName: string;
    overallResult: string;
    dashboardUrl?: string;
  }) {
    const isPass = data.overallResult === 'PASS' || data.overallResult === 'PASSED';
    const html = `
      <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D4FF;">assessexpert</h1>
        <h2>Your Assessment Result</h2>
        <p>Hi ${candidateName},</p>
        <p>Thank you for completing the <strong>${data.assessmentName}</strong> assessment with <strong>${data.companyName}</strong>.</p>
        <p>Your results have been reviewed and the report is now available to the hiring team. They will be in touch with the next steps.</p>
        <p style="color: #94A3B8; font-size: 13px;">If you have questions about your result or process, please contact ${data.companyName} directly.</p>
        <hr style="border-color: rgba(255,255,255,0.08); margin: 24px 0;">
        <p style="color: #475569; font-size: 12px; text-align: center;">assessexpert | Powered by Orbit Training · Dubai, UAE</p>
      </div>`;
    return this.sendEmail(candidateEmail, `Your Assessment Result — ${data.assessmentName}`, html);
  }

  async createPortalNotification(userId: string, type: string, title: string, message: string, payload?: any, actionUrl?: string) {
    return this.prisma.notification.create({
      data: { userId, type, title, message, payload, actionUrl },
    });
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }
}
