import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async getLeads(agentId?: string, filters?: any) {
    const where: any = {};
    if (agentId) where.assignedAgentId = agentId;
    if (filters?.status) where.status = filters.status;
    return this.prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async createLead(data: any) {
    return this.prisma.lead.create({ data });
  }

  async updateLead(id: string, data: any) {
    return this.prisma.lead.update({ where: { id }, data });
  }

  async getMyCompanies(agentId: string) {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return this.prisma.organization.findMany({
      where: { assignedSalesAgentId: agentId },
      include: {
        _count: { select: { sessions: true, candidates: true } },
      },
      orderBy: { contractEndDate: 'asc' },
    });
  }

  async getDashboardStats(agentId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [newLeads, renewalsDue, myCompanies] = await Promise.all([
      this.prisma.lead.count({ where: { assignedAgentId: agentId, createdAt: { gte: weekAgo } } }),
      this.prisma.organization.count({
        where: { assignedSalesAgentId: agentId, contractEndDate: { lte: in90Days, gte: new Date() } },
      }),
      this.prisma.organization.count({ where: { assignedSalesAgentId: agentId } }),
    ]);

    return { newLeads, renewalsDue, myCompanies };
  }
}
