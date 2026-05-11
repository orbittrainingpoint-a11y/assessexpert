import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  // Fisher-Yates shuffle with crypto seed
  private fisherYatesShuffle<T>(array: T[], seed: string): T[] {
    const arr = [...array];
    // Use seed to create deterministic but unpredictable shuffle
    let seedNum = parseInt(seed.substring(0, 8), 16);
    for (let i = arr.length - 1; i > 0; i--) {
      seedNum = (seedNum * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(seedNum) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async drawExamQuestions(assessmentTypeId: string, sessionId: string, proctorId: string, language = 'en') {
    // Check if already assigned
    const existing = await this.prisma.sessionQuestionAssignment.findUnique({ where: { sessionId } });
    if (existing) return existing;

    const pool = await this.prisma.question.findMany({
      where: { assessmentTypeId, status: 'ACTIVE', language },
    });

    if (pool.length < 25) {
      throw new BadRequestException(`Insufficient active questions in pool. Found ${pool.length}, need 25.`);
    }

    const seed = randomBytes(16).toString('hex');
    const shuffled = this.fisherYatesShuffle(pool, seed);
    const selected = shuffled.slice(0, 25);

    const questionOrder = selected.map((q, i) => ({
      questionId: q.id,
      position: i + 1,
      answeredAt: null,
      timeSpentSeconds: null,
    }));

    const assignment = await this.prisma.sessionQuestionAssignment.create({
      data: {
        sessionId,
        questionIds: selected.map(q => q.id),
        questionOrder,
        shuffleSeed: seed,
        generatedByProctorId: proctorId,
      },
    });

    // Increment usage count
    await this.prisma.question.updateMany({
      where: { id: { in: selected.map(q => q.id) } },
      data: { usageCount: { increment: 1 } },
    });

    return assignment;
  }

  async getCurrentQuestion(sessionId: string) {
    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId },
    });
    if (!assignment) throw new NotFoundException('No question assignment found');

    const answeredCount = await this.prisma.examAnswer.count({ where: { sessionId } });
    const order = assignment.questionOrder as any[];

    if (answeredCount >= 25) return { completed: true, totalAnswered: 25 };

    const currentItem = order[answeredCount];
    const question = await this.prisma.question.findUnique({
      where: { id: currentItem.questionId },
    });

    if (!question) throw new NotFoundException('Question not found');

    // Return question WITHOUT correct answer
    return {
      position: currentItem.position,
      totalQuestions: 25,
      questionId: question.id,
      type: question.type,
      content: question.content,
      options: question.options,
      marks: question.marks,
      timeStarted: new Date().toISOString(),
    };
  }

  async submitAnswer(sessionId: string, questionId: string, response: any, timeSpentSeconds: number) {
    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId },
    });
    if (!assignment) throw new NotFoundException('No question assignment found');

    const order = assignment.questionOrder as any[];
    const answeredCount = await this.prisma.examAnswer.count({ where: { sessionId } });
    const currentItem = order[answeredCount];

    if (currentItem.questionId !== questionId) {
      throw new BadRequestException('Question ID mismatch - cannot skip questions');
    }

    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    // Compute correctness
    const correctAnswers = question.correctAnswer as string[];
    const candidateAnswers = Array.isArray(response) ? response : [response];
    const isCorrect = JSON.stringify(correctAnswers.sort()) === JSON.stringify(candidateAnswers.sort());

    const answer = await this.prisma.examAnswer.create({
      data: {
        sessionId,
        questionId,
        position: currentItem.position,
        questionSnapshot: {
          content: question.content,
          options: question.options,
          type: question.type,
          correctAnswer: question.correctAnswer, // stored for historical report accuracy
        },
        candidateResponse: response,
        isCorrect,
        correctAnswer: question.correctAnswer,
        timeSpentSeconds,
        marks: isCorrect ? question.marks : 0,
        maxMarks: question.marks,
      },
    });

    // Update order with answered timestamp
    const updatedOrder = order.map((item, idx) =>
      idx === answeredCount
        ? { ...item, answeredAt: new Date().toISOString(), timeSpentSeconds }
        : item
    );
    await this.prisma.sessionQuestionAssignment.update({
      where: { sessionId },
      data: { questionOrder: updatedOrder },
    });

    const nextPosition = answeredCount + 1;
    const isComplete = nextPosition >= 25;

    return {
      answered: true,
      position: currentItem.position,
      isComplete,
      nextPosition: isComplete ? null : nextPosition + 1,
    };
  }

  async getQuestions(filters: any) {
    const where: any = {};
    if (filters.assessmentTypeId) where.assessmentTypeId = filters.assessmentTypeId;
    if (filters.status) where.status = filters.status;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.domain) where.domain = { contains: filters.domain, mode: 'insensitive' };
    if (filters.search) {
      where.content = { path: ['text'], string_contains: filters.search };
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { assessmentType: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(filters.limit) || 50,
        skip: parseInt(filters.offset) || 0,
      }),
      this.prisma.question.count({ where }),
    ]);

    return { questions, total };
  }

  async getQuestion(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { assessmentType: { select: { name: true } } },
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async createQuestion(data: any, createdBy: string) {
    return this.prisma.question.create({
      data: { ...data, createdBy, version: 1 },
    });
  }

  async updateQuestion(id: string, data: any, updatedBy: string) {
    const existing = await this.getQuestion(id);
    const versionHistory = (existing.versionHistory as any[]) || [];
    versionHistory.push({
      version: existing.version,
      updatedBy,
      updatedAt: new Date().toISOString(),
      data: {
        content: existing.content,
        options: existing.options,
        correctAnswer: existing.correctAnswer,
        difficulty: existing.difficulty,
        domain: existing.domain,
      },
    });

    return this.prisma.question.update({
      where: { id },
      data: { ...data, version: existing.version + 1, versionHistory },
    });
  }

  async archiveQuestion(id: string) {
    return this.prisma.question.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async activateQuestion(id: string) {
    return this.prisma.question.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async bulkActivate(params: { ids?: string[]; assessmentTypeId?: string }) {
    // If ids provided, activate only those; otherwise activate all DRAFT questions
    // for the given assessmentTypeId. At least one filter is required.
    const where: any = { status: 'DRAFT' };
    if (params.ids && params.ids.length > 0) {
      where.id = { in: params.ids };
    } else if (params.assessmentTypeId) {
      where.assessmentTypeId = params.assessmentTypeId;
    } else {
      return { activated: 0, message: 'Provide ids[] or assessmentTypeId' };
    }
    const result = await this.prisma.question.updateMany({
      where,
      data: { status: 'ACTIVE' },
    });
    return { activated: result.count };
  }

  async getPoolStats(assessmentTypeId: string) {
    const [active, draft, archived, byDifficulty, byDomain] = await Promise.all([
      this.prisma.question.count({ where: { assessmentTypeId, status: 'ACTIVE' } }),
      this.prisma.question.count({ where: { assessmentTypeId, status: 'DRAFT' } }),
      this.prisma.question.count({ where: { assessmentTypeId, status: 'ARCHIVED' } }),
      this.prisma.question.groupBy({
        by: ['difficulty'],
        where: { assessmentTypeId, status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.question.groupBy({
        by: ['domain'],
        where: { assessmentTypeId, status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    return {
      active,
      draft,
      archived,
      total: active + draft + archived,
      target: 500,
      healthStatus: active >= 500 ? 'GREEN' : active >= 200 ? 'AMBER' : 'RED',
      byDifficulty,
      byDomain,
    };
  }

  async bulkImport(questions: any[], assessmentTypeId: string, createdBy: string) {
    const results = { success: 0, errors: [] as any[] };
    for (const [idx, q] of questions.entries()) {
      try {
        await this.prisma.question.create({
          data: {
            assessmentTypeId,
            type: q.type || 'MCQ_SINGLE',
            content: { text: q.questionText },
            options: [
              { key: 'A', text: q.optionA },
              { key: 'B', text: q.optionB },
              { key: 'C', text: q.optionC },
              { key: 'D', text: q.optionD },
              ...(q.optionE ? [{ key: 'E', text: q.optionE }] : []),
            ],
            correctAnswer: q.correctAnswers.split(',').map((a: string) => a.trim()),
            explanation: q.explanation,
            difficulty: q.difficulty || 'MEDIUM',
            domain: q.domain || 'General',
            tags: q.tags ? q.tags.split(',').map((t: string) => t.trim()) : [],
            marks: parseFloat(q.marks) || 1,
            language: q.language || 'en',
            status: 'DRAFT',
            createdBy,
            version: 1,
          },
        });
        results.success++;
      } catch (e) {
        results.errors.push({ row: idx + 2, error: e.message });
      }
    }
    return results;
  }
}
