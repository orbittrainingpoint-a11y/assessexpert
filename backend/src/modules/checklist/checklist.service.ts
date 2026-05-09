import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CHECKLIST_ITEMS = [
  { key: 'camera_verified', label: 'Camera confirmed active', required: true },
  { key: 'identity_name', label: 'Candidate identity verified — name', required: true },
  { key: 'identity_email', label: 'Candidate identity verified — email', required: true },
  { key: 'government_id', label: 'Government ID verified', required: true },
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

  async initChecklist(sessionId: string, proctorId: string) {
    const existing = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    if (existing) return existing;

    const items = CHECKLIST_ITEMS.map(item => ({
      ...item,
      completed: false,
      completedAt: null,
      notes: null,
    }));

    const checklist = await this.prisma.proctorChecklist.create({
      data: { sessionId, proctorId, items },
    });

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'CHECKLIST' },
    });

    return checklist;
  }

  async completeItem(sessionId: string, itemKey: string, data: { notes?: string; value?: any }, proctorId: string) {
    const checklist = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    if (!checklist) throw new NotFoundException('Checklist not found');

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

    // Handle special items
    if (itemKey === 'identity_name') updateData.candidateNameConfirmed = data.value;
    if (itemKey === 'identity_email') updateData.candidateEmailConfirmed = true;
    if (itemKey === 'facial_recognition') updateData.frVerificationResult = data.value;
    if (itemKey === 'guidelines_agreed') {
      updateData.examGuidelinesDelivered = true;
      updateData.candidateAgreedToRules = true;
    }

    // Check if all required items are complete
    const allRequired = items.filter(i => i.required).every(i => i.completed);
    if (allRequired) {
      updateData.completedAt = new Date();
    }

    return this.prisma.proctorChecklist.update({
      where: { sessionId },
      data: updateData,
    });
  }

  async getChecklist(sessionId: string) {
    const checklist = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    if (!checklist) throw new NotFoundException('Checklist not found');
    return checklist;
  }

  async isChecklistComplete(sessionId: string): Promise<boolean> {
    const checklist = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    if (!checklist) return false;
    return !!checklist.completedAt;
  }

  async getAllChecklistsForSession(sessionId: string) {
    // For future multi-candidate support, return array
    const checklist = await this.prisma.proctorChecklist.findUnique({ where: { sessionId } });
    return checklist ? [checklist] : [];
  }

  async areAllChecklistsComplete(sessionId: string): Promise<boolean> {
    // For now, single candidate - check if the one checklist is complete
    return this.isChecklistComplete(sessionId);
  }

  getChecklistTemplate() {
    return CHECKLIST_ITEMS;
  }
}
