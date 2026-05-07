import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getOrganizations(filters?: any) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { primaryContactEmail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: { _count: { select: { users: true, candidates: true, sessions: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(filters?.limit) || 50,
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { organizations: orgs, total };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } },
        _count: { select: { candidates: true, sessions: true, reports: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async createOrganization(data: any) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return this.prisma.organization.create({
      data: { ...data, slug: `${slug}-${Date.now()}` },
    });
  }

  async updateOrganization(id: string, data: any) {
    await this.getOrganization(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  async suspendOrganization(id: string, reason: string) {
    return this.prisma.organization.update({
      where: { id },
      data: { status: 'SUSPENDED', internalNotes: reason },
    });
  }

  async getDashboardStats() {
    const [totalActive, totalSuspended, totalTrial] = await Promise.all([
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.organization.count({ where: { status: 'TRIAL' } }),
    ]);
    return { totalActive, totalSuspended, totalTrial, total: totalActive + totalSuspended + totalTrial };
  }
}
