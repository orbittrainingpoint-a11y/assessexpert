import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private prisma: PrismaService) {}

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
        take: parseInt(filters?.limit) || 50,
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

  async createUser(data: any) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(data.password || 'TempPass123!', 12);
    const { password, ...rest } = data;

    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, organizationId: true, status: true,
      },
    });
  }

  async updateUser(id: string, data: any) {
    await this.getUser(id);
    const { password, ...rest } = data;
    const updateData: any = { ...rest };
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.update({
      where: { id },
      data: updateData,
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

    // TODO: Send email with invitation link
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`;
    this.logger.log(`Invitation link: ${inviteLink}`);

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
