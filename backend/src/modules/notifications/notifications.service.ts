import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;

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
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@assessexpert.ae',
        to,
        subject,
        html,
      });
      return { sent: true };
    } catch (e) {
      console.error('Email send failed:', e.message);
      return { sent: false, error: e.message };
    }
  }

  async sendCandidateInvitation(candidateEmail: string, candidateName: string, data: {
    companyName: string;
    assessmentName: string;
    scheduledAt: Date;
    timezone: string;
    magicLink: string;
  }) {
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
          <tr><td style="color: #94A3B8; padding: 8px 0;">Date & Time:</td><td style="color: #F1F5F9;"><strong>${data.scheduledAt.toLocaleString()} (${data.timezone})</strong></td></tr>
          <tr><td style="color: #94A3B8; padding: 8px 0;">Duration:</td><td style="color: #F1F5F9;"><strong>Approximately 90 minutes</strong></td></tr>
        </table>
        <p style="color: #94A3B8;">Please ensure you have a working webcam, microphone, and stable internet connection.</p>
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
