import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PracticalTasksService {
  constructor(private prisma: PrismaService) {}

  async getTasks(filters?: any) {
    const where: any = {};
    if (filters?.assessmentTypeId) where.assessmentTypeId = filters.assessmentTypeId;
    if (filters?.status) where.status = filters.status;
    return this.prisma.practicalTask.findMany({
      where,
      include: { assessmentType: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTask(id: string) {
    const task = await this.prisma.practicalTask.findUnique({
      where: { id },
      include: { assessmentType: { select: { name: true } } },
    });
    if (!task) throw new NotFoundException('Practical task not found');
    return task;
  }

  async createTask(data: any, createdBy: string) {
    return this.prisma.practicalTask.create({
      data: { ...data, createdBy },
    });
  }

  async updateTask(id: string, data: any) {
    await this.getTask(id);
    return this.prisma.practicalTask.update({ where: { id }, data });
  }

  async archiveTask(id: string) {
    return this.prisma.practicalTask.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }
}
