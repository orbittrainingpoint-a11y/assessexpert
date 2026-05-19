import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as path from 'path';

@Injectable()
export class PracticalSetsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── PaperSet CRUD ──────────────────────────────────────────────────────

  async listSets(assessmentTypeId?: string) {
    return this.prisma.practicalPaperSet.findMany({
      where: assessmentTypeId ? { assessmentTypeId } : {},
      include: {
        _count: { select: { questions: true, files: true } },
        assessmentType: { select: { id: true, name: true, shortCode: true } },
      },
      orderBy: [{ assessmentTypeId: 'asc' }, { name: 'asc' }],
    });
  }

  async getSet(id: string, opts: { includeFiles?: boolean; includeQuestions?: boolean } = {}) {
    const set = await this.prisma.practicalPaperSet.findUnique({
      where: { id },
      include: {
        files: opts.includeFiles ?? true,
        questions: opts.includeQuestions
          ? {
              orderBy: { position: 'asc' },
              include: { fileRefs: { include: { file: true } } },
            }
          : false,
        assessmentType: { select: { id: true, name: true, shortCode: true, practicalTimeLimit: true } },
      },
    });
    if (!set) throw new NotFoundException('Paper set not found');
    return set;
  }

  async createSet(data: { assessmentTypeId: string; name: string; description?: string }, createdBy: string) {
    return this.prisma.practicalPaperSet.create({
      data: { ...data, createdBy },
    });
  }

  async updateSet(id: string, data: { name?: string; description?: string; status?: any }) {
    await this.getSet(id, { includeFiles: false, includeQuestions: false });
    return this.prisma.practicalPaperSet.update({ where: { id }, data });
  }

  async activateSet(id: string) {
    return this.prisma.practicalPaperSet.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async deleteSet(id: string) {
    // Cascade handles files & questions
    return this.prisma.practicalPaperSet.delete({ where: { id } });
  }

  // ── Files in a set ─────────────────────────────────────────────────────

  async addFile(setId: string, file: Express.Multer.File, uploadedBy: string) {
    if (!file) throw new BadRequestException('file required');
    await this.getSet(setId, { includeFiles: false, includeQuestions: false });
    const storedPath = await this.storage.saveFile('practical-set-files', file.originalname, file.buffer);
    return this.prisma.practicalSetFile.create({
      data: {
        setId,
        fileName: file.originalname,
        filePath: storedPath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy,
      },
    });
  }

  async deleteFile(fileId: string) {
    const f = await this.prisma.practicalSetFile.findUnique({ where: { id: fileId } });
    if (!f) throw new NotFoundException('File not found');
    try { await this.storage.deleteFile(f.filePath); } catch {}
    return this.prisma.practicalSetFile.delete({ where: { id: fileId } });
  }

  async listFiles(setId: string) {
    return this.prisma.practicalSetFile.findMany({
      where: { setId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Questions in a set ─────────────────────────────────────────────────

  async createQuestion(
    setId: string,
    data: {
      prompt: string;
      answerType: 'FILE_UPLOAD' | 'NUMERIC' | 'TEXT';
      marks?: number;
      rubric?: string;
      referencedFileIds?: string[];
      // FILE_UPLOAD
      acceptedFileTypes?: string[];
      maxFileSizeMB?: number;
      // NUMERIC
      expectedNumericAnswer?: number;
      numericTolerance?: number;
      numericUnit?: string;
      numericMatchMode?: 'EXACT' | 'TOLERANCE';
      // TEXT
      expectedTextAnswer?: string;
      textMatchMode?: 'EXACT' | 'CONTAINS' | 'MANUAL';
      textCaseSensitive?: boolean;
    },
  ) {
    await this.getSet(setId, { includeFiles: false, includeQuestions: false });
    // Determine next position
    const last = await this.prisma.practicalQuestion.findFirst({
      where: { setId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1;

    const { referencedFileIds, ...rest } = data;
    const created = await this.prisma.practicalQuestion.create({
      data: {
        ...rest,
        setId,
        position,
        marks: data.marks ?? 1,
        acceptedFileTypes: data.acceptedFileTypes ?? [],
        fileRefs: referencedFileIds && referencedFileIds.length > 0
          ? {
              create: referencedFileIds.map(fileId => ({ fileId })),
            }
          : undefined,
      },
      include: { fileRefs: { include: { file: true } } },
    });
    return created;
  }

  async updateQuestion(
    id: string,
    data: any & { referencedFileIds?: string[] },
  ) {
    const existing = await this.prisma.practicalQuestion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');

    const { referencedFileIds, position: _ignorePos, ...rest } = data;
    // If referencedFileIds provided, reset the join table
    if (referencedFileIds) {
      await this.prisma.practicalQuestionFile.deleteMany({ where: { questionId: id } });
      if (referencedFileIds.length > 0) {
        await this.prisma.practicalQuestionFile.createMany({
          data: referencedFileIds.map((fileId: string) => ({ questionId: id, fileId })),
        });
      }
    }
    return this.prisma.practicalQuestion.update({
      where: { id },
      data: rest,
      include: { fileRefs: { include: { file: true } } },
    });
  }

  async deleteQuestion(id: string) {
    return this.prisma.practicalQuestion.delete({ where: { id } });
  }

  async reorderQuestions(setId: string, orderedIds: string[]) {
    // Two-phase update to avoid unique-constraint collision on (setId, position)
    const offset = 10000;
    for (let i = 0; i < orderedIds.length; i++) {
      await this.prisma.practicalQuestion.update({
        where: { id: orderedIds[i] },
        data: { position: offset + i + 1 },
      });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await this.prisma.practicalQuestion.update({
        where: { id: orderedIds[i] },
        data: { position: i + 1 },
      });
    }
    return { reordered: orderedIds.length };
  }

  // ── Assign set to a session ────────────────────────────────────────────

  // Assign a paper set to a session. In multi-candidate slots a proctor
  // can target a specific candidate via candidateId so different people
  // get different sets; with no candidateId on a multi-candidate slot we
  // write the set to EVERY candidate (the "assign-to-all" default).
  // Single-candidate sessions keep using the ExamSession columns.
  async assignSetToSession(sessionId: string, setId: string, candidateId?: string) {
    const set = await this.prisma.practicalPaperSet.findUnique({ where: { id: setId } });
    if (!set) throw new NotFoundException('Set not found');
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    // Save the set. If MCQ is done, also flip into practical phase
    // (matches sessionsService.assignPracticalTask behaviour for the legacy flow).
    const allowedToStart = ['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'];
    const shouldStartPractical = allowedToStart.includes(session.status);

    if (session.isMultiCandidate) {
      // Validate candidateId if supplied; reject ids not part of this slot
      if (candidateId && candidateId !== session.candidateId) {
        const sc = await this.prisma.sessionCandidate.findUnique({
          where: { sessionId_candidateId: { sessionId, candidateId } },
          select: { id: true },
        });
        if (!sc) throw new BadRequestException('candidateId is not part of this session');
      }

      // Multi: write to SessionCandidate (one row, or all rows for the "all" fan-out)
      if (candidateId) {
        await this.prisma.sessionCandidate.upsert({
          where: { sessionId_candidateId: { sessionId, candidateId } },
          create: { sessionId, candidateId, practicalPaperSetId: setId, practicalTaskId: null },
          update: { practicalPaperSetId: setId, practicalTaskId: null },
        });
      } else {
        // Assign-to-all: every SessionCandidate row in this slot
        const all = await this.prisma.sessionCandidate.findMany({
          where: { sessionId },
          select: { candidateId: true },
        });
        await Promise.all(all.map(sc =>
          this.prisma.sessionCandidate.update({
            where: { sessionId_candidateId: { sessionId, candidateId: sc.candidateId } },
            data: { practicalPaperSetId: setId, practicalTaskId: null },
          }),
        ));
      }

      // Flip the slot into practical phase the first time anyone gets a set
      if (shouldStartPractical) {
        return this.prisma.examSession.update({
          where: { id: sessionId },
          data: { status: 'PRACTICAL_IN_PROGRESS', practicalStartedAt: new Date() },
          include: { practicalPaperSet: true },
        });
      }
      return this.prisma.examSession.findUnique({
        where: { id: sessionId },
        include: { practicalPaperSet: true },
      });
    }

    // Single-candidate: legacy behaviour, write to session columns.
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        practicalPaperSetId: setId,
        ...(shouldStartPractical
          ? { status: 'PRACTICAL_IN_PROGRESS', practicalStartedAt: new Date() }
          : {}),
      },
      include: { practicalPaperSet: true },
    });
  }

  // ── Candidate-facing: get assigned set for a session (by magic token) ──

  // Resolve which set this candidate sees. Multi-candidate slots prefer
  // the SessionCandidate row so each candidate can have their own set;
  // falls back to the session-level column for single-candidate sessions
  // (and as a safety net for multi-candidate slots that were assigned
  // before per-candidate routing was wired).
  async getAssignedSetForSession(sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { practicalPaperSetId: true, candidateId: true, isMultiCandidate: true },
    });
    if (!session) return null;

    let setId: string | null = null;
    if (session.isMultiCandidate || candidateId) {
      const cId = candidateId || session.candidateId;
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        select: { practicalPaperSetId: true },
      });
      setId = sc?.practicalPaperSetId || session.practicalPaperSetId || null;
    } else {
      setId = session.practicalPaperSetId;
    }
    if (!setId) return null;
    const set = await this.getSet(setId, { includeFiles: true, includeQuestions: true });
    // Strip grader-only fields before sending to candidate; include downloadable URL
    const toFileView = (f: { id: string; fileName: string; fileSize?: number; mimeType?: string | null; filePath?: string }) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      // Public download URL — main.ts serves ./storage at /uploads/*
      downloadUrl: this.publicUrlForStoredPath(f.filePath || ''),
    });

    return {
      id: set.id,
      name: set.name,
      description: set.description,
      assessmentType: set.assessmentType,
      files: set.files.map(toFileView),
      questions: ((set as any).questions || []).map((q: any) => ({
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        answerType: q.answerType,
        marks: q.marks,
        acceptedFileTypes: q.acceptedFileTypes,
        maxFileSizeMB: q.maxFileSizeMB,
        numericUnit: q.numericUnit,
        referencedFiles: q.fileRefs.map((fr: any) => toFileView(fr.file)),
      })),
    };
  }

  private publicUrlForStoredPath(storedPath: string): string {
    if (!storedPath) return '';
    // saved paths look like "./storage/practical-set-files/12345-abc.dwg" or absolute
    const path = require('path') as typeof import('path');
    const base = path.resolve(process.env.STORAGE_PATH || './storage');
    const rel = path.relative(base, path.resolve(storedPath)).replace(/\\/g, '/');
    return `/uploads/${rel}`;
  }

  // ── Submit an answer ───────────────────────────────────────────────────

  async submitAnswer(
    sessionId: string,
    candidateId: string,
    questionId: string,
    payload: {
      numericValue?: number;
      textValue?: string;
      file?: Express.Multer.File;
    },
  ) {
    const question = await this.prisma.practicalQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    const baseData: any = {
      sessionId,
      candidateId,
      questionId,
      submittedAt: new Date(),
      maxMarks: question.marks,
    };

    let autoGraded = false;
    let marks: number | undefined;
    let isCorrect: boolean | undefined;

    if (question.answerType === 'FILE_UPLOAD') {
      if (!payload.file) throw new BadRequestException('File required for this question');
      // Validate file type if restrictions exist
      const allowedExts = question.acceptedFileTypes || [];
      if (allowedExts.length > 0) {
        const ext = path.extname(payload.file.originalname).toLowerCase();
        if (!allowedExts.map(e => e.toLowerCase()).includes(ext)) {
          throw new BadRequestException(`File type not allowed. Accepted: ${allowedExts.join(', ')}`);
        }
      }
      // Validate size
      if (question.maxFileSizeMB && payload.file.size > question.maxFileSizeMB * 1024 * 1024) {
        throw new BadRequestException(`File too large. Max ${question.maxFileSizeMB} MB`);
      }
      const stored = await this.storage.saveFile('practical-answers', payload.file.originalname, payload.file.buffer);
      baseData.uploadedFilePath = stored;
      baseData.uploadedFileName = payload.file.originalname;
      baseData.uploadedFileSize = payload.file.size;
      // File uploads always need manual grading
    }

    if (question.answerType === 'NUMERIC') {
      if (payload.numericValue === undefined || payload.numericValue === null) {
        throw new BadRequestException('Numeric value required');
      }
      baseData.numericValue = payload.numericValue;
      // Auto-grade
      if (question.expectedNumericAnswer !== null && question.expectedNumericAnswer !== undefined) {
        const expected = question.expectedNumericAnswer;
        const got = payload.numericValue;
        let correct = false;
        if (question.numericMatchMode === 'EXACT') {
          correct = expected === got;
        } else {
          // TOLERANCE
          const tol = question.numericTolerance ?? 0;
          correct = Math.abs(expected - got) <= tol;
        }
        isCorrect = correct;
        marks = correct ? question.marks : 0;
        autoGraded = true;
      }
    }

    if (question.answerType === 'TEXT') {
      if (!payload.textValue || !payload.textValue.trim()) {
        throw new BadRequestException('Text value required');
      }
      baseData.textValue = payload.textValue;
      // Auto-grade for EXACT / CONTAINS, never for MANUAL
      if (question.expectedTextAnswer && question.textMatchMode !== 'MANUAL') {
        const expected = question.textCaseSensitive ? question.expectedTextAnswer : question.expectedTextAnswer.toLowerCase();
        const got = question.textCaseSensitive ? payload.textValue : payload.textValue.toLowerCase();
        let correct = false;
        if (question.textMatchMode === 'EXACT') correct = expected.trim() === got.trim();
        else if (question.textMatchMode === 'CONTAINS') correct = got.includes(expected);
        isCorrect = correct;
        marks = correct ? question.marks : 0;
        autoGraded = true;
      }
    }

    if (autoGraded) {
      baseData.marks = marks;
      baseData.isCorrect = isCorrect;
      baseData.autoGraded = true;
      baseData.gradedAt = new Date();
    }

    // Upsert so candidates can resubmit until session finalised
    return this.prisma.practicalAnswer.upsert({
      where: { sessionId_candidateId_questionId: { sessionId, candidateId, questionId } },
      create: baseData,
      update: baseData,
    });
  }

  async listAnswers(sessionId: string, candidateId?: string) {
    return this.prisma.practicalAnswer.findMany({
      where: candidateId ? { sessionId, candidateId } : { sessionId },
      include: { question: true },
      orderBy: { question: { position: 'asc' } },
    });
  }

  async gradeAnswer(answerId: string, data: { marks?: number; graderNotes?: string }, graderId: string) {
    return this.prisma.practicalAnswer.update({
      where: { id: answerId },
      data: {
        ...data,
        isCorrect: data.marks !== undefined ? data.marks > 0 : undefined,
        gradedBy: graderId,
        gradedAt: new Date(),
        autoGraded: false,
      },
    });
  }
}
