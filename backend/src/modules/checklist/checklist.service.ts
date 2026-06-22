import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CandidateSessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const CHECKLIST_ITEMS = [
  { key: 'camera_verified', label: 'Camera confirmed active', required: true },
  { key: 'identity_name', label: 'Candidate identity verified — name', required: true },
  { key: 'identity_email', label: 'Candidate identity verified — email', required: true },
  // `government_id` key preserved for DB compatibility with historical
  // checklist rows. User-facing label is now document-agnostic — covers
  // passport, Emirates ID, driver's licence, national ID, employee badge,
  // etc. — since real-world candidates rarely have a US-style "government
  // ID card" specifically.
  { key: 'government_id', label: 'Identity verified per document', required: true },
  { key: 'background_scan', label: 'Background scan completed', required: true },
  { key: 'no_materials', label: 'No unauthorized materials visible', required: true },
  { key: 'facial_recognition', label: 'Facial recognition check passed', required: true },
  { key: 'guardpro', label: 'GuardPro connected (if required)', required: false },
  { key: 'screen_share', label: 'Screen share active', required: true },
  { key: 'guidelines_agreed', label: 'Exam guidelines read + candidate agreed', required: true },
];

@Injectable()
export class ChecklistService {
  constructor(private prisma: PrismaService) {}

  // Resolve the candidate that a checklist call targets. Multi-candidate
  // slots MUST pass one; single-candidate sessions fall back to the
  // session's primary candidate so existing callers keep working.
  private async resolveCandidateId(sessionId: string, candidateId?: string): Promise<string> {
    if (candidateId) return candidateId;
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, isMultiCandidate: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.isMultiCandidate && !candidateId) {
      throw new BadRequestException('candidateId is required for multi-candidate sessions');
    }
    return session.candidateId;
  }

  async initChecklist(sessionId: string, proctorId: string, candidateId?: string) {
    const cId = await this.resolveCandidateId(sessionId, candidateId);
    const existing = await this.prisma.proctorChecklist.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (existing) return existing;

    const items = CHECKLIST_ITEMS.map(item => ({
      ...item,
      completed: false,
      completedAt: null,
      notes: null,
    }));

    const checklist = await this.prisma.proctorChecklist.create({
      data: { sessionId, candidateId: cId, proctorId, items },
    });

    // Move the session into CHECKLIST status the first time ANY candidate
    // has a checklist row. Idempotent — repeated transitions are no-ops.
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'CHECKLIST' },
    });

    return checklist;
  }

  async completeItem(
    sessionId: string,
    itemKey: string,
    data: { notes?: string; value?: any; candidateId?: string },
    proctorId: string,
  ) {
    const cId = await this.resolveCandidateId(sessionId, data.candidateId);

    // Lazy upsert — the frontend doesn't always call init explicitly, and
    // for multi-candidate slots there's no init-for-everyone step. The
    // first completeItem for a candidate creates their checklist row.
    let checklist = await this.prisma.proctorChecklist.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!checklist) {
      const items = CHECKLIST_ITEMS.map(item => ({
        ...item, completed: false, completedAt: null, notes: null,
      }));
      checklist = await this.prisma.proctorChecklist.create({
        data: { sessionId, candidateId: cId, proctorId, items },
      });
    }

    const items = checklist.items as any[];
    const itemIndex = items.findIndex(i => i.key === itemKey);
    if (itemIndex === -1) throw new NotFoundException(`Checklist item '${itemKey}' not found`);

    items[itemIndex] = {
      ...items[itemIndex],
      completed: true,
      completedAt: new Date().toISOString(),
      notes: data.notes,
      value: data.value,
    };

    const updateData: any = { items };

    // Mirror selected items onto the dedicated columns
    if (itemKey === 'identity_name') updateData.candidateNameConfirmed = data.value;
    if (itemKey === 'identity_email') updateData.candidateEmailConfirmed = true;
    if (itemKey === 'facial_recognition') updateData.frVerificationResult = data.value;
    if (itemKey === 'guidelines_agreed') {
      updateData.examGuidelinesDelivered = true;
      updateData.candidateAgreedToRules = true;
    }

    // All required items done for THIS candidate?
    const allRequired = items.filter(i => i.required).every(i => i.completed);
    if (allRequired) {
      updateData.completedAt = new Date();
    }

    const updated = await this.prisma.proctorChecklist.update({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
      data: updateData,
    });

    // Mirror "checklist fully done" onto SessionCandidate.status so the
    // frontend can derive `allVerified` from a single source of truth.
    // Without this, the proctor UI had two sources (local verifiedIds
    // set + DB) that drifted on refresh and stale-reloaded the "All
    // Verified — Start Exam" button into the disabled state.
    if (allRequired) {
      try {
        await this.prisma.sessionCandidate.updateMany({
          where: {
            sessionId,
            candidateId: cId,
            status: { in: [CandidateSessionStatus.PENDING, CandidateSessionStatus.JOINED, CandidateSessionStatus.VERIFYING] },
          },
          data: { status: CandidateSessionStatus.VERIFIED, verifiedAt: new Date() },
        });
      } catch {
        // SessionCandidate row may not exist for very old single-candidate
        // sessions that pre-date the unification backfill. The backend
        // checklist row is still the durable record of completion, so we
        // swallow this rather than letting it break the proctor flow.
      }
    }

    return updated;
  }

  async getChecklist(sessionId: string, candidateId?: string) {
    const cId = await this.resolveCandidateId(sessionId, candidateId);
    const checklist = await this.prisma.proctorChecklist.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!checklist) throw new NotFoundException('Checklist not found');
    return checklist;
  }

  async isChecklistComplete(sessionId: string, candidateId?: string): Promise<boolean> {
    const cId = await this.resolveCandidateId(sessionId, candidateId);
    const checklist = await this.prisma.proctorChecklist.findUnique({
      where: { sessionId_candidateId: { sessionId, candidateId: cId } },
    });
    if (!checklist) return false;
    return !!checklist.completedAt;
  }

  async getAllChecklistsForSession(sessionId: string) {
    return this.prisma.proctorChecklist.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // True only when EVERY candidate in the slot has a completed checklist.
  // For multi-candidate sessions we iterate the SessionCandidate rows so
  // a slot with 3 candidates needs 3 completed checklists.
  async areAllChecklistsComplete(sessionId: string): Promise<boolean> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, isMultiCandidate: true, sessionCandidates: { select: { candidateId: true } } },
    });
    if (!session) return false;

    const expected = new Set<string>([session.candidateId]);
    session.sessionCandidates.forEach(sc => expected.add(sc.candidateId));

    const checklists = await this.prisma.proctorChecklist.findMany({
      where: { sessionId },
      select: { candidateId: true, completedAt: true },
    });
    const completedFor = new Set(
      checklists.filter(c => !!c.completedAt).map(c => c.candidateId),
    );
    for (const id of expected) {
      if (!completedFor.has(id)) return false;
    }
    return true;
  }

  getChecklistTemplate() {
    return CHECKLIST_ITEMS;
  }
}
