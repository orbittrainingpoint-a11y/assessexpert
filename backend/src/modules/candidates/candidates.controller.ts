import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { parse as parseCsv } from 'csv-parse/sync';
import { CandidatesService } from './candidates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private candidatesService: CandidatesService) {}

  @Get()
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async getCandidates(@Req() req: any, @Query() filters: any) {
    const orgId = req.user.role === 'SUPER_ADMIN' ? filters.organizationId : req.user.organizationId;
    return this.candidatesService.getCandidates(orgId, filters);
  }

  @Get(':id')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async getCandidate(@Param('id') id: string, @Req() req: any) {
    return this.candidatesService.getCandidate(id, req.user.organizationId);
  }

  @Post()
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async createCandidate(@Body() body: any, @Req() req: any) {
    // For SUPER_ADMIN, organizationId must be provided in body
    // For others, use their organizationId
    const organizationId = req.user.role === 'SUPER_ADMIN' 
      ? body.organizationId 
      : req.user.organizationId;
    
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    return this.candidatesService.createCandidate(body, organizationId);
  }

  @Put(':id')
  @Roles('HR_MANAGER', 'ORG_ADMIN')
  async updateCandidate(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.candidatesService.updateCandidate(id, body, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('HR_MANAGER', 'ORG_ADMIN')
  async deleteCandidate(@Param('id') id: string, @Req() req: any) {
    return this.candidatesService.deleteCandidate(id, req.user.organizationId);
  }

  // GDPR "right to be forgotten". Unlike DELETE above (which refuses to
  // touch candidates with any exam history), this purges everything —
  // sessions, answers, recordings, FR logs, reports — and writes a
  // tamper-evident audit row so the action of forgetting is itself
  // auditable. SUPER_ADMIN only because it's destructive and irreversible.
  @Post(':id/gdpr-delete')
  @Roles('SUPER_ADMIN')
  async gdprDeleteCandidate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const reason = (body?.reason || '').trim();
    if (reason.length < 10) {
      throw new BadRequestException('A reason of at least 10 characters is required for GDPR delete (data-subject request ref, ticket id, etc.).');
    }
    return this.candidatesService.gdprDeleteCandidate(id, req.user.id, req.user.email, reason);
  }

  @Post('import')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async bulkImport(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file?.buffer) throw new BadRequestException('CSV file required');
    // Use a real RFC-4180 parser. The previous hand-rolled split-on-comma
    // broke on quoted fields containing commas ("Smith, John"), didn't
    // handle CRLF, and didn't unescape doubled quotes.
    let rows: any[];
    try {
      rows = parseCsv(file.buffer, {
        columns: header => header.map((h: string) => h.trim()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (e: any) {
      throw new BadRequestException(`Invalid CSV: ${e.message}`);
    }
    if (rows.length > 5000) {
      throw new BadRequestException('CSV exceeds 5000 rows. Split the file and import in batches.');
    }
    return this.candidatesService.bulkImport(rows, req.user.organizationId);
  }
}
