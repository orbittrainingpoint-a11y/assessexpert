import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordingsService } from '../recordings/recordings.service';
import { PracticalSetsService } from '../practical-sets/practical-sets.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private recordings: RecordingsService,
    private practicalSets: PracticalSetsService,
  ) {}

  // Best-effort recording finalize. Awaits the merge so the recording
  // paths are set on the session row before HR can ask for the URL,
  // but never lets a finalize failure kill the calling transition.
  private async safeFinalize(sessionId: string) {
    try {
      await this.recordings.finalizeRecording(sessionId);
    } catch (e: any) {
      this.logger.warn(`Recording finalize failed for ${sessionId}: ${e?.message || e}`);
    }
  }

  async createSession(data: {
    assessmentTypeId: string;
    candidateId: string;
    organizationId: string;
    proctorId?: string;
    scheduledAt: Date;
  }) {
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours from scheduled time

    const session = await this.prisma.examSession.create({
      data: {
        ...data,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
      },
      include: { candidate: true, assessmentType: true },
    });

    return session;
  }

  async createMultiCandidateSession(data: {
    assessmentTypeId: string;
    candidateIds: string[];
    organizationId: string;
    proctorId?: string;
    scheduledAt: Date;
  }) {
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(data.scheduledAt.getTime() + 4 * 60 * 60 * 1000);

    const session = await this.prisma.examSession.create({
      data: {
        assessmentTypeId: data.assessmentTypeId,
        candidateId: data.candidateIds[0],
        organizationId: data.organizationId,
        proctorId: data.proctorId,
        scheduledAt: data.scheduledAt,
        magicToken: token,
        tokenExpiresAt,
        status: 'SCHEDULED',
        isMultiCandidate: true,
        sessionCandidates: {
          create: data.candidateIds.map(candidateId => ({
            candidateId,
            status: 'PENDING',
          })),
        },
      },
      include: { candidate: true, assessmentType: true, sessionCandidates: { include: { candidate: true } } },
    });

    return session;
  }

  async addCandidateToSession(sessionId: string, candidateId: string) {
    return this.prisma.sessionCandidate.create({
      data: { sessionId, candidateId, status: 'PENDING' },
      include: { candidate: true },
    });
  }

  // Append a verification-conversation utterance to the session transcript.
  // We only accept lines while the session is in pre-exam phases — once the
  // candidate has moved into MCQ/practical/submitted, the transcript freezes.
  async appendVerificationTranscript(
    sessionId: string,
    line: { candidateId?: string; speaker: 'PROCTOR' | 'CANDIDATE'; text: string; timestamp?: string },
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, candidateId: true, verificationTranscript: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    const FROZEN = ['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'COMPLETED', 'DISQUALIFIED'];
    if (FROZEN.includes(session.status)) {
      // Don't error — just refuse to mutate. Caller can ignore the response.
      return { appended: false, reason: 'transcript frozen' };
    }
    // Cap line length so a flooded mic / runaway TTS can't fill the JSON
    // column or blow up dashboard queries. 5000 chars is generous (~750
    // words) and well under Postgres jsonb size.
    const text = (line.text || '').trim().slice(0, 5000);
    if (!text) return { appended: false, reason: 'empty' };

    // If the caller names a candidateId, it MUST belong to this session.
    // Otherwise an attacker with one candidate's token could inject lines
    // attributed to another candidate.
    if (line.candidateId && line.candidateId !== session.candidateId) {
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId, candidateId: line.candidateId } },
        select: { id: true },
      });
      if (!sc) return { appended: false, reason: 'candidate not in session' };
    }

    const current: any = (session.verificationTranscript as any) || { lines: [] };
    const lines = Array.isArray(current.lines) ? current.lines : [];
    lines.push({
      candidateId: line.candidateId,
      speaker: line.speaker,
      text,
      timestamp: line.timestamp || new Date().toISOString(),
    });
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { verificationTranscript: { lines } },
    });
    return { appended: true, count: lines.length };
  }

  async getVerificationTranscript(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { verificationTranscript: true },
    });
    const t: any = session?.verificationTranscript || { lines: [] };
    return { lines: Array.isArray(t.lines) ? t.lines : [] };
  }

  async getSessionCandidates(sessionId: string) {
    return this.prisma.sessionCandidate.findMany({
      where: { sessionId },
      include: { candidate: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateCandidateStatus(sessionId: string, candidateId: string, status: string, data?: any) {
    return this.prisma.sessionCandidate.update({
      where: { sessionId_candidateId: { sessionId, candidateId } },
      data: { status: status as any, ...data },
    });
  }

  async checkAllCandidatesVerified(sessionId: string) {
    const candidates = await this.prisma.sessionCandidate.findMany({ where: { sessionId } });
    const allVerified = candidates.every(c => c.status === 'VERIFIED' || c.status === 'MCQ_IN_PROGRESS' || c.status === 'MCQ_SUBMITTED' || c.status === 'PRACTICAL_IN_PROGRESS' || c.status === 'PRACTICAL_SUBMITTED' || c.status === 'COMPLETED');
    return { allVerified, total: candidates.length, verified: candidates.filter(c => c.verifiedAt).length };
  }

  async checkAllMCQSubmitted(sessionId: string) {
    const candidates = await this.prisma.sessionCandidate.findMany({ where: { sessionId } });
    const allSubmitted = candidates.every(c => c.status === 'MCQ_SUBMITTED' || c.status === 'PRACTICAL_IN_PROGRESS' || c.status === 'PRACTICAL_SUBMITTED' || c.status === 'COMPLETED');
    return { allSubmitted, total: candidates.length, submitted: candidates.filter(c => c.mcqSubmittedAt).length };
  }

  async getSession(id: string, organizationId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      include: {
        candidate: true,
        assessmentType: true,
        checklists: true,
        questionAssignments: true,
        reports: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (organizationId && session.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }

    // Attach MCQ score so the proctor's submission view can show the real
    // count even after a page refresh. For multi-candidate slots, this is
    // the PRIMARY candidate's tally — per-candidate scores arrive via the
    // exam.mcqSubmitted socket event as each candidate finishes.
    const [answeredCount, correctCount] = await Promise.all([
      this.prisma.examAnswer.count({ where: { sessionId: id, candidateId: session.candidateId } }),
      this.prisma.examAnswer.count({ where: { sessionId: id, candidateId: session.candidateId, isCorrect: true } }),
    ]);
    const mcqTotal = session.assessmentType?.mcqQuestionCount ?? 25;
    return Object.assign(session, {
      mcqAnsweredCount: answeredCount,
      mcqCorrectCount: correctCount,
      mcqTotal,
    });
  }

  async getSessionByToken(token: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: {
        candidate: true,
        assessmentType: true,
        checklists: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionsForProctor(proctorId: string, date?: string) {
    const where: any = { proctorId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
    const sessions = await this.prisma.examSession.findMany({
      where,
      include: {
        candidate: true,
        assessmentType: true,
        organization: true,
        // Include the slot's candidates so the proctor's "today" list can
        // show every person in a slot (not just the primary) and reflect
        // who has already joined.
        sessionCandidates: { include: { candidate: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return { sessions };
  }

  async getSessionsForOrg(organizationId: string, filters?: any) {
    const where: any = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.from && filters?.to) {
      where.scheduledAt = { gte: new Date(filters.from), lte: new Date(filters.to) };
    }
    return this.prisma.examSession.findMany({
      where,
      include: { candidate: true, assessmentType: true },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAllSessions(filters?: any) {
    const where: any = {};
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.status) where.status = filters.status;
    if (filters?.proctorId) where.proctorId = filters.proctorId;
    // Query-string values arrive as strings. Prisma's take/skip require
    // numbers and throws otherwise — coerce safely with a fallback.
    const take = Number.parseInt(filters?.limit as any, 10);
    const skip = Number.parseInt(filters?.offset as any, 10);
    const sessions = await this.prisma.examSession.findMany({
      where,
      include: { candidate: true, assessmentType: true, organization: true },
      orderBy: { scheduledAt: 'desc' },
      take: Number.isFinite(take) && take > 0 ? take : 100,
      skip: Number.isFinite(skip) && skip > 0 ? skip : 0,
    });
    return { sessions };
  }

  async getLiveSessions() {
    return this.prisma.examSession.findMany({
      where: {
        status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'CHECKLIST', 'WAITING_ROOM'] },
      },
      include: { candidate: true, assessmentType: true, organization: true },
    });
  }

  async updateSessionStatus(id: string, status: string, additionalData?: any) {
    return this.prisma.examSession.update({
      where: { id },
      data: { status: status as any, ...additionalData },
    });
  }

  async startMcq(sessionId: string, proctorId: string) {
    const session = await this.getSession(sessionId);
    const alreadyStarted = ['MCQ_IN_PROGRESS', 'MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL', 'PRACTICAL_IN_PROGRESS', 'SUBMITTED'];
    if (alreadyStarted.includes(session.status)) {
      // Idempotent — already started, return current session
      return session;
    }
    if (!['CHECKLIST', 'WAITING_ROOM', 'SCHEDULED'].includes(session.status)) {
      throw new BadRequestException(`Cannot start MCQ from status: ${session.status}`);
    }

    // In dev mode skip checklist enforcement. In production, EVERY candidate
    // in the slot must have a completed checklist before MCQs start.
    if (process.env.NODE_ENV === 'production') {
      const candidatesNeedingChecklist = new Set<string>([session.candidateId]);
      const scRows = await this.prisma.sessionCandidate.findMany({
        where: { sessionId },
        select: { candidateId: true },
      });
      scRows.forEach(r => candidatesNeedingChecklist.add(r.candidateId));

      const checklists = await this.prisma.proctorChecklist.findMany({
        where: { sessionId },
        select: { candidateId: true, completedAt: true },
      });
      const completedFor = new Set(
        checklists.filter(c => !!c.completedAt).map(c => c.candidateId),
      );
      for (const cid of candidatesNeedingChecklist) {
        if (!completedFor.has(cid)) {
          throw new ForbiddenException('Proctor checklist must be fully completed for every candidate before starting the exam');
        }
      }
    }

    // Question pool draw — same logic per candidate, but with a fresh
    // seed for each so multi-candidate slots get DIFFERENT shuffled orders.
    const pool = await this.prisma.question.findMany({
      where: { assessmentTypeId: session.assessmentTypeId, status: 'ACTIVE' },
    });
    if (pool.length < 25) {
      throw new BadRequestException(`Insufficient active questions: ${pool.length} found, 25 required.`);
    }

    const drawForCandidate = async (candidateId: string) => {
      const seed = randomBytes(16).toString('hex');
      const arr = [...pool];
      let seedNum = parseInt(seed.substring(0, 8), 16);
      for (let i = arr.length - 1; i > 0; i--) {
        seedNum = (seedNum * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(seedNum) % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      const selected = arr.slice(0, 25);
      const questionOrder = selected.map((q, i) => ({
        questionId: q.id, position: i + 1, answeredAt: null, timeSpentSeconds: null,
      }));
      await this.prisma.sessionQuestionAssignment.upsert({
        where: { sessionId_candidateId: { sessionId, candidateId } },
        create: { sessionId, candidateId, questionIds: selected.map(q => q.id), questionOrder, shuffleSeed: seed, generatedByProctorId: proctorId },
        update: { questionIds: selected.map(q => q.id), questionOrder, shuffleSeed: seed, generatedByProctorId: proctorId },
      });
    };

    // Build the list of candidates to draw for: every SessionCandidate row,
    // plus the primary candidate (fallback for non-multi sessions). Dedupe
    // by candidateId so the primary doesn't get a second assignment if
    // they're also listed as a SessionCandidate.
    const ids = new Set<string>([session.candidateId]);
    const scRows = await this.prisma.sessionCandidate.findMany({
      where: { sessionId },
      select: { candidateId: true },
    });
    scRows.forEach(r => ids.add(r.candidateId));
    for (const cid of ids) {
      await drawForCandidate(cid);
    }

    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS', mcqStartedAt: new Date() },
    });
  }

  // PER-CANDIDATE MCQ COMPLETION
  //
  // Single-candidate session: flips ExamSession.status straight to
  //   MCQ_COMPLETE the first time anyone calls this.
  //
  // Multi-candidate session: updates the calling candidate's
  //   SessionCandidate.status + mcqSubmittedAt only. The session-level
  //   status stays MCQ_IN_PROGRESS until EVERY candidate in the slot
  //   has finished — otherwise the first finisher would lock the others
  //   out of /exam/question/submit (which gates on session.status).
  async completeMcq(sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { isMultiCandidate: true, candidateId: true },
    });
    if (!session) return null;

    // Multi-candidate: mark THIS candidate done, then check the aggregate.
    if (session.isMultiCandidate) {
      const cId = candidateId || session.candidateId;
      // Update the SessionCandidate row (create-if-missing for slots where
      // the primary candidate was never added to the SessionCandidate
      // table — the auto-merge path adds them, but be defensive).
      await this.prisma.sessionCandidate.upsert({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        create: {
          sessionId,
          candidateId: cId,
          status: 'MCQ_SUBMITTED',
          mcqSubmittedAt: new Date(),
        },
        update: {
          status: 'MCQ_SUBMITTED',
          mcqSubmittedAt: new Date(),
        },
      });

      // Have ALL candidates in this slot finished MCQ now? Build the set
      // of expected candidates from the SessionCandidate table + the
      // primary (defensive — primary should already be in the SC table
      // after auto-merge but we don't rely on that).
      const scRows = await this.prisma.sessionCandidate.findMany({
        where: { sessionId },
        select: { candidateId: true, status: true },
      });
      const expectedIds = new Set<string>([session.candidateId]);
      scRows.forEach(r => expectedIds.add(r.candidateId));
      const finishedStatuses = new Set([
        'MCQ_SUBMITTED', 'PRACTICAL_IN_PROGRESS', 'PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED',
      ]);
      const finishedIds = new Set(
        scRows.filter(r => finishedStatuses.has(r.status)).map(r => r.candidateId),
      );
      const allDone = Array.from(expectedIds).every(id => finishedIds.has(id));

      if (allDone) {
        const updated = await this.prisma.examSession.update({
          where: { id: sessionId },
          data: { status: 'MCQ_COMPLETE', mcqSubmittedAt: new Date() },
        });
        // Auto-assign a random practical set per candidate the moment
        // the slot finishes MCQ — fire-and-forget so a failure here
        // doesn't roll back the MCQ_COMPLETE transition. The proctor
        // can still manually override any assignment in PracticalPanel
        // before pushing practical to the candidates.
        this.practicalSets.autoAssignRandomSets(sessionId).catch(e => {
          this.logger.warn(`Auto-assign practical sets failed for ${sessionId}: ${e?.message || e}`);
        });
        return updated;
      }
      // Some candidates still going — leave session.status at MCQ_IN_PROGRESS.
      return this.prisma.examSession.findUnique({ where: { id: sessionId } });
    }

    // Single-candidate legacy branch. Post-unification every session has
    // isMultiCandidate=true so this only fires for pre-migration rows;
    // still auto-assign a random set so behaviour is identical.
    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_COMPLETE', mcqSubmittedAt: new Date() },
    });
    this.practicalSets.autoAssignRandomSets(sessionId).catch(e => {
      this.logger.warn(`Auto-assign practical sets failed for ${sessionId}: ${e?.message || e}`);
    });
    return updated;
  }

  // Assign a legacy practical task to a session. With candidateId on a
  // multi-candidate slot, only that candidate's SessionCandidate row gets
  // the task; with no candidateId on a multi-candidate slot, every row
  // gets it. Single-candidate sessions write to the ExamSession column
  // (legacy behaviour). Flips the slot into PRACTICAL_IN_PROGRESS the
  // first time anyone gets assigned.
  async assignPracticalTask(sessionId: string, practicalTaskId: string, proctorId: string, candidateId?: string) {
    const session = await this.getSession(sessionId) as any;
    const allowedStatuses = ['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException('MCQ must be completed before assigning practical task');
    }

    if (session.isMultiCandidate) {
      if (candidateId && candidateId !== session.candidateId) {
        const sc = await this.prisma.sessionCandidate.findUnique({
          where: { sessionId_candidateId: { sessionId, candidateId } },
          select: { id: true },
        });
        if (!sc) throw new BadRequestException('candidateId is not part of this session');
      }

      if (candidateId) {
        await this.prisma.sessionCandidate.upsert({
          where: { sessionId_candidateId: { sessionId, candidateId } },
          create: { sessionId, candidateId, practicalTaskId, practicalPaperSetId: null },
          update: { practicalTaskId, practicalPaperSetId: null },
        });
      } else {
        const all = await this.prisma.sessionCandidate.findMany({
          where: { sessionId },
          select: { candidateId: true },
        });
        await Promise.all(all.map(sc =>
          this.prisma.sessionCandidate.update({
            where: { sessionId_candidateId: { sessionId, candidateId: sc.candidateId } },
            data: { practicalTaskId, practicalPaperSetId: null },
          }),
        ));
      }

      return this.prisma.examSession.update({
        where: { id: sessionId },
        data: {
          status: 'PRACTICAL_IN_PROGRESS',
          practicalStartedAt: new Date(),
        },
        include: { practicalTask: true },
      });
    }

    // Single-candidate: legacy behaviour.
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        practicalTaskId,
        status: 'PRACTICAL_IN_PROGRESS',
        practicalStartedAt: new Date(),
      },
      include: { practicalTask: true },
    });
  }

  // Per-candidate practical submit. Mirrors completeMcq: in a multi-
  // candidate slot we flip ONE candidate to PRACTICAL_SUBMITTED, then
  // only flip session.status=SUBMITTED once EVERY candidate has finished.
  // candidateId may be undefined for single-candidate / legacy callers —
  // we resolve to the primary in that case.
  async submitPractical(sessionId: string, filePath?: string, fileName?: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { isMultiCandidate: true, candidateId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    const cId = candidateId || session.candidateId;

    if (session.isMultiCandidate) {
      await this.prisma.sessionCandidate.upsert({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        create: {
          sessionId, candidateId: cId,
          status: 'PRACTICAL_SUBMITTED',
          practicalSubmittedAt: new Date(),
        },
        update: {
          status: 'PRACTICAL_SUBMITTED',
          practicalSubmittedAt: new Date(),
        },
      });

      const scRows = await this.prisma.sessionCandidate.findMany({
        where: { sessionId },
        select: { candidateId: true, status: true },
      });
      const expectedIds = new Set<string>([session.candidateId]);
      scRows.forEach(r => expectedIds.add(r.candidateId));
      const finishedStatuses = new Set(['PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED']);
      const allDone = Array.from(expectedIds).every(id => {
        const sc = scRows.find(r => r.candidateId === id);
        return sc ? finishedStatuses.has(sc.status as any) : false;
      });

      if (!allDone) {
        return this.prisma.examSession.findUnique({ where: { id: sessionId } });
      }
    }

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: 'SUBMITTED',
        practicalSubmittedAt: new Date(),
        practicalFilePath: filePath,
        practicalFileName: fileName,
        recordingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // The session is now SUBMITTED — finalise any in-flight recording so
    // HR's "Watch Recording" link works as soon as the proctor opens the
    // report. Best-effort; failure logs a warning but doesn't block.
    await this.safeFinalize(sessionId);
    return updated;
  }

  // Reassign a live session to a different proctor. Master-proctor-only
  // from the controller. Returns the previous proctorId so the caller
  // can emit `proctor.reassigned` and write an audit entry — the service
  // stays free of gateway / audit dependencies on purpose.
  async reassignProctor(sessionId: string, newProctorId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { id: true, proctorId: true, status: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Verify the incoming proctor exists, is ACTIVE, and has the right
    // role. Reassigning to a non-PROCTOR (e.g. an HR user) would let
    // someone bypass the role guard entirely on subsequent calls.
    const newProctor = await this.prisma.user.findUnique({
      where: { id: newProctorId },
      select: { id: true, role: true, status: true, firstName: true, lastName: true, email: true },
    });
    if (!newProctor) throw new NotFoundException('Target proctor not found');
    if (newProctor.status !== 'ACTIVE') {
      throw new BadRequestException('Target proctor is not active');
    }
    if (!['PROCTOR', 'MASTER_PROCTOR'].includes(newProctor.role)) {
      throw new BadRequestException('Target user is not a proctor');
    }
    if (session.proctorId === newProctorId) {
      throw new BadRequestException('Session is already assigned to this proctor');
    }

    const previousProctorId = session.proctorId;
    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { proctorId: newProctorId },
    });
    return { session: updated, previousProctorId, newProctor };
  }

  async terminateSession(sessionId: string, reason: string, proctorId: string) {
    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: 'DISQUALIFIED',
        disqualified: true,
        disqualifyReason: reason,
      },
    });
    // Disqualified sessions still need a viewable recording for review.
    await this.safeFinalize(sessionId);
    return updated;
  }

  async pauseSession(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    // Store previous status so resume can restore it
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS' }, // keep status, pause is communicated via WS only
    });
  }

  async resumeSession(sessionId: string) {
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'MCQ_IN_PROGRESS' },
    });
  }

  async getDashboardStats(organizationId?: string) {
    const where: any = organizationId ? { organizationId } : {};
    const [total, thisMonth, live, pendingReview] = await Promise.all([
      this.prisma.examSession.count({ where }),
      this.prisma.examSession.count({
        where: {
          ...where,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.examSession.count({
        where: { ...where, status: { in: ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'] } },
      }),
      this.prisma.examSession.count({
        where: { ...where, status: 'PENDING_PROCTOR_REVIEW' },
      }),
    ]);
    return { total, thisMonth, live, pendingReview };
  }
}
