import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);
  constructor(private prisma: PrismaService) {}

  async getCandidates(organizationId: string, filters?: any) {
    const where: any = { organizationId };
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { jobPosition: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [candidates, total] = await Promise.all([
      this.prisma.candidateRecord.findMany({
        where,
        include: {
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { report: { select: { overallScore: true, overallPassed: true, status: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(filters?.limit) || 25,
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.candidateRecord.count({ where }),
    ]);
    return { candidates, total };
  }

  async getCandidate(id: string, organizationId: string) {
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            assessmentType: true,
            report: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.organizationId !== organizationId) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async createCandidate(data: any, organizationId: string) {
    try {
      this.logger.log(`Creating candidate with data: ${JSON.stringify({ ...data, organizationId })}`);
      
      // Validate required fields
      if (!data.email) {
        throw new BadRequestException('Email is required');
      }
      if (!data.firstName) {
        throw new BadRequestException('First name is required');
      }
      if (!data.lastName) {
        throw new BadRequestException('Last name is required');
      }
      if (!organizationId) {
        throw new BadRequestException('Organization ID is required');
      }

      // Check for existing candidate
      const existing = await this.prisma.candidateRecord.findUnique({
        where: { email_organizationId: { email: data.email, organizationId } },
      });
      if (existing) {
        this.logger.warn(`Duplicate candidate email: ${data.email}`);
        throw new ConflictException('Candidate with this email already exists');
      }

      // Create candidate with validated data
      const candidateData = {
        organizationId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        jobPosition: data.jobPosition || '',
        yearsExperience: data.yearsExperience || null,
        department: data.department || null,
        notes: data.notes || null,
        batchId: data.batchId || null,
        source: data.source || 'MANUAL',
      };

      this.logger.log(`Creating candidate with validated data: ${JSON.stringify(candidateData)}`);
      const candidate = await this.prisma.candidateRecord.create({
        data: candidateData,
      });
      
      this.logger.log(`Candidate created successfully: ${candidate.id}`);
      return candidate;
    } catch (error) {
      this.logger.error(`Error creating candidate: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateCandidate(id: string, data: any, organizationId: string) {
    await this.getCandidate(id, organizationId);
    // Whitelist editable fields — never let the client move a candidate to
    // another org or rewrite system columns.
    const editable: any = {};
    for (const k of ['firstName', 'lastName', 'email', 'phone', 'jobPosition', 'yearsExperience', 'department', 'notes']) {
      if (data[k] !== undefined) editable[k] = data[k];
    }

    // If the email is changing, make sure it doesn't collide with another
    // candidate in the same org (the (email, organizationId) pair is unique).
    if (editable.email !== undefined) {
      const clash = await this.prisma.candidateRecord.findUnique({
        where: { email_organizationId: { email: editable.email, organizationId } },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException('Another candidate in this organization already uses this email');
      }
    }

    try {
      return await this.prisma.candidateRecord.update({ where: { id }, data: editable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Another candidate in this organization already uses this email');
      }
      throw error;
    }
  }

  async deleteCandidate(id: string, organizationId: string) {
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id },
      include: { sessions: { select: { id: true, status: true } } },
    });
    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException('Candidate not found');
    }

    // Sessions that have actually been taken must be preserved (audit trail).
    const PROTECTED = [
      'CHECKLIST', 'WAITING_ROOM', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS',
      'SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED',
    ];
    const taken = candidate.sessions.filter(s => PROTECTED.includes(s.status));
    if (taken.length > 0) {
      throw new ConflictException(
        `Cannot delete: this candidate has ${taken.length} exam session(s) that have started or completed. Exam history must be preserved.`,
      );
    }

    // Only un-taken sessions remain (SCHEDULED / INVITED / CANCELLED / NO_SHOW) —
    // safe to remove along with their multi-candidate links.
    const sessionIds = candidate.sessions.map(s => s.id);
    await this.prisma.$transaction([
      this.prisma.sessionCandidate.deleteMany({
        where: { OR: [{ candidateId: id }, { sessionId: { in: sessionIds } }] },
      }),
      this.prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } }),
      this.prisma.candidateRecord.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async bulkImport(rows: any[], organizationId: string) {
    const results = { success: 0, errors: [] as any[], duplicates: 0 };
    for (const [idx, row] of rows.entries()) {
      try {
        const existing = await this.prisma.candidateRecord.findUnique({
          where: { email_organizationId: { email: row.email, organizationId } },
        });
        if (existing) {
          results.duplicates++;
          results.errors.push({ row: idx + 2, error: `Duplicate email: ${row.email}` });
          continue;
        }
        await this.prisma.candidateRecord.create({
          data: {
            organizationId,
            email: row.email,
            firstName: row.firstName || row['First Name'],
            lastName: row.lastName || row['Last Name'],
            phone: row.phone || row['Phone'],
            jobPosition: row.jobPosition || row['Job Role'] || '',
            yearsExperience: row.yearsExperience || row['Experience (years)'],
            notes: row.notes || row['Notes'],
            source: 'UPLOAD',
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
