import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
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
}
