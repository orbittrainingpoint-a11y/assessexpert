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

  // PER-CANDIDATE MCQ FLOW
  //
  // Each candidate in a multi-candidate slot gets their own SessionQuestion-
  // Assignment row keyed on (sessionId, candidateId) so they receive a
  // different shuffled order and their answers don't collide.
  //
  // For single-candidate sessions this is transparent: the caller passes
  // session.candidateId and we behave the same as before.

  async drawExamQuestions(
    assessmentTypeId: string,
    sessionId: string,
    proctorId: string,
    language = 'en',
    candidateId?: string,
  ) {
    if (!candidateId) {
      throw new BadRequestException('candidateId is required for question assignment');
    }
    const existing = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId } },
    });
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
        candidateId,
        questionIds: selected.map(q => q.id),
        questionOrder,
        shuffleSeed: seed,
        generatedByProctorId: proctorId,
      },
    });

    await this.prisma.question.updateMany({
      where: { id: { in: selected.map(q => q.id) } },
      data: { usageCount: { increment: 1 } },
    });

    return assignment;
  }

  async getCurrentQuestion(sessionId: string, candidateId: string) {
    if (!candidateId) throw new BadRequestException('candidateId is required');
    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId } },
    });
    if (!assignment) throw new NotFoundException('No question assignment found for this candidate');

    const answeredCount = await this.prisma.examAnswer.count({
      where: { sessionId, candidateId },
    });
    const order = assignment.questionOrder as any[];

    if (answeredCount >= 25) return { completed: true, totalAnswered: 25 };

    const currentItem = order[answeredCount];
    const question = await this.prisma.question.findUnique({
      where: { id: currentItem.questionId },
    });

    if (!question) throw new NotFoundException('Question not found');

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

  async submitAnswer(
    sessionId: string,
    questionId: string,
    response: any,
    timeSpentSeconds: number,
    candidateId: string,
  ) {
    if (!candidateId) throw new BadRequestException('candidateId is required');
    const assignment = await this.prisma.sessionQuestionAssignment.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId } },
    });
    if (!assignment) throw new NotFoundException('No question assignment found for this candidate');

    const order = assignment.questionOrder as any[];
    const answeredCount = await this.prisma.examAnswer.count({
      where: { sessionId, candidateId },
    });
    const currentItem = order[answeredCount];

    if (currentItem.questionId !== questionId) {
      throw new BadRequestException('Question ID mismatch - cannot skip questions');
    }

    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    const correctAnswers = question.correctAnswer as string[];
    const candidateAnswers = Array.isArray(response) ? response : [response];
    const isCorrect = JSON.stringify(correctAnswers.sort()) === JSON.stringify(candidateAnswers.sort());

    await this.prisma.examAnswer.create({
      data: {
        sessionId,
        candidateId,
        questionId,
        position: currentItem.position,
        questionSnapshot: {
          content: question.content,
          options: question.options,
          type: question.type,
          correctAnswer: question.correctAnswer,
        },
        candidateResponse: response,
        isCorrect,
        correctAnswer: question.correctAnswer,
        timeSpentSeconds,
        marks: isCorrect ? question.marks : 0,
        maxMarks: question.marks,
      },
    });

    const updatedOrder = order.map((item, idx) =>
      idx === answeredCount
        ? { ...item, answeredAt: new Date().toISOString(), timeSpentSeconds }
        : item,
    );
    await this.prisma.sessionQuestionAssignment.update({
      where: { sessionId_candidateId: { sessionId, candidateId } },
      data: { questionOrder: updatedOrder },
    });

    const nextPosition = answeredCount + 1;
    const isComplete = nextPosition >= 25;

    return {
      answered: true,
      position: currentItem.position,
      isCorrect,
      isComplete,
      nextPosition: isComplete ? null : nextPosition + 1,
      answeredCount: nextPosition,
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
        take: Math.min(parseInt(filters.limit) || 50, 500),
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

  // Bulk-import question rows produced by the CSV/XLSX parser in the
  // controller. Each row is validated, then created as a DRAFT
  // Question. The result lists per-row errors so the importer can fix
  // them without re-uploading the whole file. Row numbers in errors
  // are 1-based and account for the header row, matching what the
  // user sees in Excel.
  //
  // Type and difficulty values are normalised through alias maps so
  // CSVs exported from other platforms (or AI-generated banks) work
  // without hand-editing. `single_choice`, `multiple choice`,
  // `beginner`, `advanced`, etc. all map to the canonical Prisma
  // enum values.
  async bulkImport(questions: any[], assessmentTypeId: string, createdBy: string) {
    const TYPE_ALIASES: Record<string, string> = {
      mcq: 'MCQ_SINGLE',
      mcqsingle: 'MCQ_SINGLE',
      single: 'MCQ_SINGLE',
      singlechoice: 'MCQ_SINGLE',
      singleselect: 'MCQ_SINGLE',
      singleanswer: 'MCQ_SINGLE',
      mcq1: 'MCQ_SINGLE',
      radio: 'MCQ_SINGLE',
      mcqmulti: 'MCQ_MULTI',
      mcqmultiple: 'MCQ_MULTI',
      multi: 'MCQ_MULTI',
      multiple: 'MCQ_MULTI',
      multichoice: 'MCQ_MULTI',
      multiplechoice: 'MCQ_MULTI',
      multiselect: 'MCQ_MULTI',
      multipleselect: 'MCQ_MULTI',
      multianswer: 'MCQ_MULTI',
      multipleanswer: 'MCQ_MULTI',
      multipleanswers: 'MCQ_MULTI',
      checkbox: 'MCQ_MULTI',
      truefalse: 'TRUE_FALSE',
      true_false: 'TRUE_FALSE',
      'true/false': 'TRUE_FALSE',
      tf: 'TRUE_FALSE',
      boolean: 'TRUE_FALSE',
      bool: 'TRUE_FALSE',
      yesno: 'TRUE_FALSE',
    };
    const DIFFICULTY_ALIASES: Record<string, string> = {
      easy: 'EASY',
      beginner: 'EASY',
      basic: 'EASY',
      simple: 'EASY',
      low: 'EASY',
      junior: 'EASY',
      '1': 'EASY',
      medium: 'MEDIUM',
      intermediate: 'MEDIUM',
      moderate: 'MEDIUM',
      mid: 'MEDIUM',
      midlevel: 'MEDIUM',
      normal: 'MEDIUM',
      average: 'MEDIUM',
      '2': 'MEDIUM',
      hard: 'HARD',
      advanced: 'HARD',
      difficult: 'HARD',
      expert: 'HARD',
      high: 'HARD',
      senior: 'HARD',
      '3': 'HARD',
    };
    // Strip whitespace, underscores, hyphens, and slashes so
    // `single_choice`, `Single-Choice`, `single choice`, and
    // `true/false` all normalise to the same lookup key.
    const normaliseKey = (s: string) => s.trim().toLowerCase().replace(/[\s_\-/]/g, '');
    const VALID_TYPES = new Set(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE']);
    const VALID_DIFFICULTY = new Set(['EASY', 'MEDIUM', 'HARD']);
    const VALID_KEYS = new Set(['A', 'B', 'C', 'D', 'E']);
    // Map 1-based numeric correct answers ("1" → "A", "2" → "B" …)
    // so AI-generated CSVs that use indices instead of letters work.
    const INDEX_TO_LETTER: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };

    const results = { success: 0, errors: [] as { row: number; error: string; questionText?: string }[] };

    for (const [idx, q] of questions.entries()) {
      const rowNum = idx + 2; // +1 for 0-index, +1 for header row
      const preview = String(q.questionText || '').slice(0, 80);
      try {
        // ── Validate required fields up-front with helpful errors ──
        if (!q.questionText) throw new Error('questionText is empty');
        if (!q.correctAnswers) throw new Error('correctAnswers is empty (use single letter A/B/C/D/E for MCQ_SINGLE, comma-separated A,B,C for MCQ_MULTI)');

        // Type — accept aliases (single_choice, multi, true_false, …)
        // plus the canonical Prisma enum values. Normalise to canonical
        // before validation.
        const rawType = String(q.type ?? 'MCQ_SINGLE').trim();
        const type = TYPE_ALIASES[normaliseKey(rawType)] || rawType.toUpperCase().replace(/[\s-]/g, '_');
        if (!VALID_TYPES.has(type)) {
          throw new Error(`type "${q.type}" is not valid (allowed: MCQ_SINGLE / single_choice, MCQ_MULTI / multiple_choice, TRUE_FALSE)`);
        }

        // Difficulty — accept aliases (beginner, intermediate, advanced,
        // 1/2/3, …) plus the canonical Prisma enum values.
        const rawDifficulty = String(q.difficulty ?? 'MEDIUM').trim();
        const difficulty = DIFFICULTY_ALIASES[normaliseKey(rawDifficulty)] || rawDifficulty.toUpperCase();
        if (!VALID_DIFFICULTY.has(difficulty)) {
          throw new Error(`difficulty "${q.difficulty}" is not valid (allowed: EASY / beginner, MEDIUM / intermediate, HARD / advanced)`);
        }

        // Options. TRUE_FALSE only needs A/B; MCQ needs at least A/B/C/D.
        const options = [
          q.optionA && { key: 'A', text: String(q.optionA) },
          q.optionB && { key: 'B', text: String(q.optionB) },
          q.optionC && { key: 'C', text: String(q.optionC) },
          q.optionD && { key: 'D', text: String(q.optionD) },
          q.optionE && { key: 'E', text: String(q.optionE) },
        ].filter(Boolean) as { key: string; text: string }[];

        if (type === 'TRUE_FALSE') {
          if (options.length < 2) throw new Error('TRUE_FALSE rows need at least optionA and optionB');
        } else if (options.length < 2) {
          throw new Error('MCQ rows need at least 2 options (A and B)');
        }

        // Correct answer keys. Accept letters (`A`, `A,C`, `A, C`) and
        // 1-based numeric indices (`1`, `1,3`) — common in AI-generated
        // CSVs. Numeric values get mapped to letters before validation.
        const correctAnswer = String(q.correctAnswers)
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => INDEX_TO_LETTER[s] || s.toUpperCase());

        if (correctAnswer.length === 0) throw new Error('correctAnswers parsed to empty');
        if (type === 'MCQ_SINGLE' && correctAnswer.length !== 1) {
          throw new Error(`MCQ_SINGLE expects exactly one correct answer, got ${correctAnswer.length}`);
        }

        const optionKeys = new Set(options.map((o) => o.key));
        for (const key of correctAnswer) {
          if (!VALID_KEYS.has(key)) throw new Error(`correctAnswers contains invalid key "${key}" (allowed: A, B, C, D, E or 1, 2, 3, 4, 5)`);
          if (!optionKeys.has(key)) throw new Error(`correctAnswers references "${key}" but option${key} is empty`);
        }

        await this.prisma.question.create({
          data: {
            assessmentTypeId,
            type: type as any,
            content: { text: String(q.questionText) },
            options,
            correctAnswer,
            explanation: q.explanation ? String(q.explanation) : null,
            difficulty: difficulty as any,
            domain: q.domain ? String(q.domain) : 'General',
            tags: q.tags ? String(q.tags).split(/[,;]/).map((t: string) => t.trim()).filter(Boolean) : [],
            marks: q.marks != null && q.marks !== '' ? parseFloat(String(q.marks)) || 1 : 1,
            language: q.language ? String(q.language).toLowerCase() : 'en',
            status: 'DRAFT',
            createdBy,
            version: 1,
          },
        });
        results.success++;
      } catch (e: any) {
        results.errors.push({ row: rowNum, error: e?.message || String(e), questionText: preview || undefined });
      }
    }
    return results;
  }
}
