import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('scheduling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scheduling')
export class SchedulingController {
  constructor(private schedulingService: SchedulingService) {}

  @Get('slots')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async getSlots(@Query() query: any) {
    return this.schedulingService.getAvailableSlots(
      query.assessmentTypeId,
      query.dateFrom,
      query.dateTo,
    );
  }

  @Get('diagnostics')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'PROCTOR', 'MASTER_PROCTOR')
  async getDiagnostics() {
    return this.schedulingService.getDiagnostics();
  }

  @Post('schedule')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async scheduleSession(@Body() body: any, @Req() req: any) {
    return this.schedulingService.scheduleSession({
      ...body,
      organizationId: req.user.organizationId || body.organizationId,
      scheduledAt: new Date(body.scheduledAt),
    });
  }
}
