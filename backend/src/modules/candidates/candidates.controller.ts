import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('import')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async bulkImport(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const content = file.buffer.toString();
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] }), {} as any);
    });
    return this.candidatesService.bulkImport(rows, req.user.organizationId);
  }
}
