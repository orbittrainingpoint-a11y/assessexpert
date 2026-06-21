import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
    const list = await this.prisma.assessmentType.findMany({
      where,
      include: {
        _count: { select: { questions: true, practicalTasks: true, sessions: true } },
      },
      orderBy: { name: 'asc' },
    });
    // Add per-row activeQuestionCount in one batch query so the admin
    // page can show "X / Y active" without needing a fan-out call per
    // row. The default `_count.questions` is total (incl. DRAFT),
    // which is misleading for the activation gate.
    if (list.length === 0) return list;
    const counts = await this.prisma.question.groupBy({
      by: ['assessmentTypeId'],
      where: { status: 'ACTIVE', assessmentTypeId: { in: list.map((at) => at.id) } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.assessmentTypeId, c._count._all]));
    return list.map((at) => ({ ...at, activeQuestionCount: countMap.get(at.id) ?? 0 }));
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

  // Flip DRAFT → ACTIVE (or ARCHIVED → ACTIVE, which restores).
  // HR can only schedule candidates against ACTIVE assessment types,
  // so this is the gate that releases an assessment for use.
  //
  // Light readiness check before activating: the type must have at
  // least `mcqQuestionCount` ACTIVE questions, otherwise a Fisher-Yates
  // pull at session start will fail. We don't check practical sets
  // here — quiz-mode and practical-skippable flows are common, and
  // adding a hard check would block valid use cases.
  async activateAssessmentType(id: string) {
    const at = await this.prisma.assessmentType.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!at) throw new NotFoundException('Assessment type not found');

    const activeQs = await this.prisma.question.count({
      where: { assessmentTypeId: id, status: 'ACTIVE' },
    });
    const needed = at.mcqQuestionCount;
    if (activeQs < needed) {
      throw new BadRequestException(
        `Cannot activate: ${at.name} needs at least ${needed} ACTIVE question${needed === 1 ? '' : 's'} to run a session, but only ${activeQs} are active. ` +
        `Go to Exam Setup → Questions for this assessment type and click "Activate Drafts".`
      );
    }

    return this.prisma.assessmentType.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }
}
