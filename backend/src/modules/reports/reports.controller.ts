import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  async getReports(@Req() req: any, @Query() filters: any) {
    if (['SUPER_ADMIN', 'MASTER_PROCTOR'].includes(req.user.role)) {
      return this.reportsService.getAllReports(filters);
    }
    if (['PROCTOR'].includes(req.user.role)) {
      return this.reportsService.getReportsForProctor(req.user.id);
    }
    // HR_MANAGER, ORG_ADMIN, HIRING_MANAGER
    if (!req.user.organizationId) {
      return { reports: [], total: 0 }; // Return empty if no org
    }
    return this.reportsService.getReportsForOrg(req.user.organizationId, filters);
  }

  @Get('session/:sessionId')
  async getReportBySession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.reportsService.getReportBySession(sessionId, req.user);
  }

  @Get(':id')
  async getReport(@Param('id') id: string, @Req() req: any) {
    return this.reportsService.getReport(id, req.user);
  }

  @Post('generate/:sessionId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR')
  async generateReport(@Param('sessionId') sessionId: string) {
    return this.reportsService.generateDraftReport(sessionId);
  }

  @Put('session/:sessionId/proctor-fields')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async updateProctorFields(
    @Param('sessionId') sessionId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.reportsService.updateProctorFields(sessionId, body, req.user.id);
  }

  @Post('session/:sessionId/publish')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async publishReport(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.reportsService.publishReport(sessionId, req.user.id);
  }

  @Post('session/:sessionId/rate')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'HIRING_MANAGER')
  async rateReport(
    @Param('sessionId') sessionId: string,
    @Body() body: { rating: number; note?: string },
    @Req() req: any,
  ) {
    return this.reportsService.rateReport(sessionId, body.rating, body.note, req.user.id);
  }

  @Post(':id/return')
  @Roles('MASTER_PROCTOR')
  async returnForModification(
    @Param('id') id: string,
    @Body() body: { instructions: string },
    @Req() req: any,
  ) {
    return this.reportsService.returnForModification(id, body.instructions, req.user.id);
  }
}
