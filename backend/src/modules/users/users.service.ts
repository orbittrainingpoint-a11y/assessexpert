import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    if (filters?.status) {
      where.status = filters.status;
    } else {
      // Exclude soft-deleted users from the default list. Explicit
      // status filter (e.g. ?status=DELETED) still surfaces them for
      // an admin audit view.
      where.status = { not: 'DELETED' };
    }
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

  // Reverse of deactivateUser — only flips back if the user is INACTIVE
  // (not DELETED). A DELETED user needs to go through create-again or
  // restore-from-deleted (separate flow, not exposed today).
  async reactivateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id }, select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'DELETED') {
      throw new BadRequestException('Deleted users cannot be reactivated — create a new user instead');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  // Soft-delete: flip status to DELETED + stamp deletedAt. Preserves the
  // row so foreign-key references (sessions the user proctored, invitations
  // they sent, audit log rows) remain intact. Excluded from every default
  // list query. Hard-delete needs a separate purge op (not built today).
  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id }, select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' as any, deletedAt: new Date() },
    });
  }

  // ── Password reset flow ────────────────────────────────────────
  //
  // Two triggers:
  //   1. User forgets password → POST /auth/forgot-password with email
  //   2. Admin sends reset link → POST /users/:id/send-password-reset
  //
  // Both flow into requestPasswordReset() which generates a 32-byte hex
  // token, stores its hash-free form on the User (guarded by the unique
  // index migration adds), and emails a magic link. Consumer submits the
  // token + new password to /auth/reset-password.
  //
  // We hash the token for audit trail via chainHash BUT store the token
  // as-is on the row so the DB lookup is cheap and constant-time. The
  // token itself is 256 bits of entropy from CSPRNG, so guess-attack risk
  // is astronomical even without hashing.

  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Deliberately return success regardless — refusing here would leak
    // whether the email is registered. Public callers see one response
    // shape; the server-side log records the real outcome.
    if (!user || user.status === 'DELETED' || user.status === 'SUSPENDED') {
      this.logger.warn(`Password reset requested for unknown/inactive email=${email.slice(0, 3)}***`);
      return { sent: true };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt } as any,
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'theassessexpert@gmail.com',
        to: user.email,
        subject: 'Reset your AssessExpert password',
        html: `
          <p>Hi ${user.firstName || ''},</p>
          <p>Someone (hopefully you) asked to reset the password for your AssessExpert account.</p>
          <p><a href="${resetLink}">Click here to set a new password</a> — this link is valid for 1 hour.</p>
          <p>If you didn't request this, ignore the email; your password stays unchanged.</p>
          <p>— AssessExpert</p>
        `,
      });
      this.logger.log(`Password reset email dispatched to userId=${user.id}`);
    } catch (e: any) {
      this.logger.warn(`Password reset email send failed for userId=${user.id}: ${e?.message || e}`);
    }
    return { sent: true };
  }

  // Called by the auth service when the user submits token + new password.
  async completePasswordReset(token: string, newPassword: string) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: token } as any,
    });
    // Same generic error for missing/expired — prevents token enumeration.
    const generic = new BadRequestException('Reset link is invalid or expired');
    if (!user) throw generic;
    const expiresAt = (user as any).passwordResetExpiresAt as Date | null;
    if (!expiresAt || expiresAt < new Date()) throw generic;

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      } as any,
    });
    this.logger.log(`Password reset completed for userId=${user.id}`);
    return { success: true };
  }

  // Admin-triggered: same underlying flow but the actor is an admin
  // acting on a specific userId (not the user submitting their email).
  async adminSendPasswordReset(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'DELETED') throw new BadRequestException('Cannot send reset link to a deleted user');
    return this.requestPasswordReset(user.email);
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

  // SAST P2 #13 — service-layer org defense. The controller currently
  // enforces that a non-SUPER_ADMIN can only invite into their own
  // org, but the service trusted `data.organizationId` blindly. If a
  // future controller change drops the check (or a different caller
  // wires this directly), the trust gap reopens. Defense-in-depth:
  // the service now validates the inviter and refuses to invite into
  // a different org unless the inviter is SUPER_ADMIN.
  async inviteUser(data: { email: string; role: string; organizationId?: string; firstName?: string; lastName?: string }, invitedBy: string) {
    this.logger.log(`Inviting user: ${data.email} with role: ${data.role}`);

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitedBy },
      select: { role: true, organizationId: true },
    });
    if (!inviter) throw new NotFoundException('Inviter not found');

    if (inviter.role !== 'SUPER_ADMIN') {
      // Non-SUPER_ADMIN inviters can only invite into their own org.
      // If they omitted organizationId we fill it in; if they tried
      // to set a different one we refuse.
      if (!data.organizationId) {
        data.organizationId = inviter.organizationId || undefined;
      } else if (data.organizationId !== inviter.organizationId) {
        this.logger.warn(`Cross-org invite attempt blocked: ${invitedBy} → org ${data.organizationId}`);
        throw new ForbiddenException('Cannot invite users into another organization');
      }
    }

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
    // SAST P1 #10 — see getInvitation. Same enumeration concern, same
    // mitigation. The "user already exists" branch can stay distinct
    // because by that point the caller has already presented a valid
    // invitation token (so they have legitimate awareness of which
    // email it was for) — that's not a fresh enumeration vector.
    const invitation = await this.prisma.userInvitation.findUnique({ where: { token } });
    const generic = new NotFoundException('Invitation not available');
    if (!invitation) {
      this.logger.warn(`acceptInvitation miss for token=${token.slice(0, 8)}…`);
      throw generic;
    }
    if (invitation.acceptedAt) {
      this.logger.warn(`acceptInvitation already-accepted, id=${invitation.id}`);
      throw generic;
    }
    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`acceptInvitation expired, id=${invitation.id}`);
      throw generic;
    }

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

  // SAST P1 #10 — public endpoint, distinct error messages for
  // "invalid" / "already accepted" / "expired" leak whether a token
  // exists. An attacker can grind tokens and read the response text
  // to enumerate valid ones. Now: one generic 404 for all three
  // failure modes; the specific reason is logged server-side only.
  // Admin-facing list of every invitation ever sent, with computed
  // status. Powers the "Pending invitations" panel on /admin/users so
  // an admin can see who was invited, whether it's still active, and
  // whether they need to resend.
  //
  // Status computation:
  //   ACCEPTED — invitation.acceptedAt is set
  //   EXPIRED  — expiresAt is in the past AND not accepted
  //   PENDING  — everything else (accepted=false, expires in the future)
  async listInvitations(filters?: { organizationId?: string; limit?: number }) {
    const where: any = {};
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    const rows = await this.prisma.userInvitation.findMany({
      where,
      select: {
        id: true, email: true, role: true, organizationId: true,
        invitedBy: true, expiresAt: true, acceptedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters?.limit || 100, 500),
    });
    // UserInvitation has organizationId but no Prisma relation to
    // Organization (see schema). Look up org names in a single batch
    // so the frontend doesn't have to resolve them itself.
    const orgIds = Array.from(new Set(rows.map(r => r.organizationId).filter(Boolean))) as string[];
    const orgs = orgIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : [];
    const orgMap = new Map(orgs.map(o => [o.id, o]));
    const now = new Date();
    return rows.map((r) => ({
      ...r,
      organization: r.organizationId ? orgMap.get(r.organizationId) || null : null,
      status: r.acceptedAt ? 'ACCEPTED'
        : r.expiresAt < now ? 'EXPIRED'
        : 'PENDING',
    }));
  }

  // Resend an invitation — refreshes the token + expiresAt and re-emails.
  // Refuses if the invitation was already accepted (nothing to resend).
  async resendInvitation(invitationId: string, invitedBy: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');

    const newToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.userInvitation.update({
      where: { id: invitationId },
      data: { token: newToken, expiresAt: newExpiresAt, invitedBy },
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${newToken}`;
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'theassessexpert@gmail.com',
        to: invitation.email,
        subject: 'AssessExpert invitation resent',
        html: `<p>Your invitation to join AssessExpert has been resent.</p><p><a href="${inviteLink}">Click here to accept</a> — link valid for 7 days.</p>`,
      });
    } catch (e: any) {
      this.logger.warn(`Invitation resend email failed for id=${invitationId}: ${e?.message || e}`);
      return { sent: false };
    }
    return { sent: true };
  }

  // Revoke an unaccepted invitation. If the user hasn't clicked the
  // link yet, this removes the row entirely. Refuses if it was already
  // accepted (then the invitation is a historical audit record).
  async revokeInvitation(invitationId: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Cannot revoke an already-accepted invitation');
    await this.prisma.userInvitation.delete({ where: { id: invitationId } });
    return { revoked: true };
  }

  async getInvitation(token: string) {
    const invitation = await this.prisma.userInvitation.findUnique({ where: { token } });
    const generic = new NotFoundException('Invitation not available');
    if (!invitation) {
      this.logger.warn(`Invitation lookup miss for token=${token.slice(0, 8)}…`);
      throw generic;
    }
    if (invitation.acceptedAt) {
      this.logger.warn(`Invitation already-accepted, id=${invitation.id}`);
      throw generic;
    }
    if (invitation.expiresAt < new Date()) {
      this.logger.warn(`Invitation expired, id=${invitation.id}`);
      throw generic;
    }

    return {
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
      expiresAt: invitation.expiresAt,
    };
  }
}
