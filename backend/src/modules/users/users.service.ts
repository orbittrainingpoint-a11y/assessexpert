import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  async getUsers(filters?: any) {
    const where: any = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, organizationId: true, status: true, mfaEnabled: true,
          lastLoginAt: true, createdAt: true, phone: true, jobTitle: true,
          certificationLevel: true, certificationDomains: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(filters?.limit) || 50, 500),
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, organizationId: true, status: true, mfaEnabled: true,
        lastLoginAt: true, createdAt: true, phone: true, jobTitle: true,
        certificationLevel: true, certificationDomains: true, languages: true,
        timezone: true, preferredLanguage: true, profilePhoto: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // SAST P0 #1, #2, #3 — explicit field allowlist instead of `...rest`
  // spread. Without this an authenticated SUPER_ADMIN (the only role
  // that can hit these endpoints) could create or escalate any user to
  // any role in any org by passing extra fields in the body, OR — by
  // accident, via a buggy frontend — set fields that should be
  // server-managed (mfaSecret, passwordResetToken, etc.).
  //
  // Hardcoded default password "TempPass123!" was removed at the same
  // time: any user created without an explicit password was bcrypted
  // from a known string, making them logged-in-as-able by anyone who
  // saw the codebase. Now the create call refuses without a password.
  private readonly USER_WRITABLE_FIELDS = new Set([
    // Identity
    'email', 'firstName', 'lastName',
    // Role + tenancy — SUPER_ADMIN is the only caller, so they
    // legitimately need to set these. They CANNOT set mfaSecret,
    // passwordResetToken, status, audit timestamps, etc.
    'role', 'organizationId',
    // Proctor fields (only relevant when role = PROCTOR)
    'certificationLevel', 'certificationDomains', 'languages', 'timezone',
    'maxSessionsPerDay',
  ]);

  private allowlistUserFields(data: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (this.USER_WRITABLE_FIELDS.has(k)) clean[k] = v;
    }
    return clean;
  }

  async createUser(data: any) {
    if (!data?.email) throw new BadRequestException('email is required');
    if (!data?.password || typeof data.password !== 'string' || data.password.length < 8) {
      throw new BadRequestException('password is required and must be at least 8 characters');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const allowed = this.allowlistUserFields(data);

    return this.prisma.user.create({
      data: { ...allowed, passwordHash } as any,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, organizationId: true, status: true,
      },
    });
  }

  async updateUser(id: string, data: any) {
    await this.getUser(id);
    const allowed = this.allowlistUserFields(data || {});
    const updateData: Record<string, unknown> = { ...allowed };
    if (typeof data?.password === 'string' && data.password.length >= 8) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }
    return this.prisma.user.update({
      where: { id },
      data: updateData as any,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
    });
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async getProctors(filters?: any) {
    return this.prisma.user.findMany({
      where: { role: 'PROCTOR', status: 'ACTIVE', ...filters },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        certificationLevel: true, certificationDomains: true, languages: true,
        timezone: true, maxSessionsPerDay: true,
      },
    });
  }

  async getAvailability(proctorId: string) {
    this.logger.log(`Getting availability for proctor: ${proctorId}`);
    
    const slots = await this.prisma.proctorAvailability.findMany({
      where: { proctorId, isOverride: false },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Get user preferences
    const user = await this.prisma.user.findUnique({
      where: { id: proctorId },
      select: { timezone: true, maxSessionsPerDay: true },
    });

    this.logger.log(`Found ${slots.length} availability slots for proctor ${proctorId}`);
    
    return {
      slots,
      timezone: user?.timezone || 'UTC',
      maxSessionsPerDay: user?.maxSessionsPerDay || 4,
    };
  }

  async saveAvailability(proctorId: string, data: {
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    timezone?: string;
    maxSessionsPerDay?: number;
  }) {
    this.logger.log(`Saving availability for proctor: ${proctorId}`);
    this.logger.log(`Received ${data.slots?.length || 0} slots`);
    
    try {
      // Delete existing availability slots
      const deleted = await this.prisma.proctorAvailability.deleteMany({
        where: { proctorId, isOverride: false },
      });
      this.logger.log(`Deleted ${deleted.count} existing slots`);

      // Create new availability slots
      if (data.slots && data.slots.length > 0) {
        const created = await this.prisma.proctorAvailability.createMany({
          data: data.slots.map(slot => ({
            proctorId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timezone: data.timezone || 'UTC',
            isOverride: false,
          })),
        });
        this.logger.log(`Created ${created.count} new slots`);
      }

      // Update user preferences
      const updateData: any = {};
      if (data.timezone) updateData.timezone = data.timezone;
      if (data.maxSessionsPerDay !== undefined) updateData.maxSessionsPerDay = data.maxSessionsPerDay;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.user.update({
          where: { id: proctorId },
          data: updateData,
        });
        this.logger.log(`Updated user preferences: ${JSON.stringify(updateData)}`);
      }

      this.logger.log(`Availability saved successfully for proctor ${proctorId}`);
      return { success: true, message: 'Availability saved successfully' };
    } catch (error) {
      this.logger.error(`Error saving availability for proctor ${proctorId}:`, error);
      throw error;
    }
  }

  async inviteUser(data: { email: string; role: string; organizationId?: string; firstName?: string; lastName?: string }, invitedBy: string) {
    this.logger.log(`Inviting user: ${data.email} with role: ${data.role}`);

    // Check if user already exists
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('User with this email already exists');

    // Check for pending invitation
    const pendingInvite = await this.prisma.userInvitation.findFirst({
      where: { email: data.email, organizationId: data.organizationId, acceptedAt: null },
    });
    if (pendingInvite) throw new ConflictException('Invitation already sent to this email');

    // Generate invitation token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const invitation = await this.prisma.userInvitation.create({
      data: {
        email: data.email,
        role: data.role as any,
        organizationId: data.organizationId,
        invitedBy,
        token,
        expiresAt,
      },
    });

    // Send invitation email
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'theassessexpert@gmail.com',
        to: data.email,
        subject: 'You have been invited to AssessExpert',
        html: `
          <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 500px; margin: 0 auto; border-radius: 12px;">
            <h1 style="color: #00D4FF; font-size: 22px; margin: 0 0 24px;">AssessExpert</h1>
            <h2 style="color: #F1F5F9; font-size: 18px;">You've been invited</h2>
            <p style="color: #94A3B8;">You have been invited to join AssessExpert as <strong style="color:#F1F5F9">${data.role.replace(/_/g, ' ')}</strong>. Click the button below to set up your account.</p>
            <a href="${inviteLink}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#00D4FF;color:#060B18;font-weight:700;border-radius:8px;text-decoration:none;">Accept Invitation</a>
            <p style="color: #475569; font-size: 12px;">This link expires in 7 days. If you did not expect this invitation, please ignore this email.</p>
          </div>`,
      });
      this.logger.log(`Invitation email sent to ${data.email}`);
    } catch (e) {
      this.logger.error(`Failed to send invitation email to ${data.email}:`, e.message);
    }

    return { success: true, inviteLink, expiresAt };
  }

  async acceptInvitation(token: string, data: { password: string; firstName: string; lastName: string; phone?: string }) {
    this.logger.log(`Accepting invitation with token: ${token}`);

    // Find invitation
    const invitation = await this.prisma.userInvitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('Invalid invitation token');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expired');

    // Check if user already exists
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new ConflictException('User already exists');

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        organizationId: invitation.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });

    // Mark invitation as accepted
    await this.prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    this.logger.log(`User created successfully: ${user.id}`);
    return user;
  }

  async getInvitation(token: string) {
    const invitation = await this.prisma.userInvitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('Invalid invitation token');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expired');

    return {
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
      expiresAt: invitation.expiresAt,
    };
  }
}
