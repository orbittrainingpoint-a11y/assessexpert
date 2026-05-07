import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  async getAssessmentTypes(filters?: any) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { jobRole: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.assessmentType.findMany({
      where,
      include: {
        _count: { select: { questions: true, practicalTasks: true, sessions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getAssessmentType(id: string) {
    const at = await this.prisma.assessmentType.findUnique({
      where: { id },
      include: {
        practicalTasks: { where: { status: 'ACTIVE' } },
        _count: { select: { questions: true, sessions: true } },
      },
    });
    if (!at) throw new NotFoundException('Assessment type not found');
    return at;
  }

  async createAssessmentType(data: any, createdBy: string) {
    return this.prisma.assessmentType.create({
      data: { ...data, createdBy },
    });
  }

  async updateAssessmentType(id: string, data: any) {
    await this.getAssessmentType(id);
    return this.prisma.assessmentType.update({ where: { id }, data });
  }

  async archiveAssessmentType(id: string) {
    return this.prisma.assessmentType.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}
