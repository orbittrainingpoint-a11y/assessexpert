import { Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
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
    // Org-tier roles MUST use their own organizationId; SUPER_ADMIN can
    // override via body to schedule on behalf of any tenant. Previous
    // code used `req.user.organizationId || body.organizationId` which
    // let an org-tier user with a momentarily-unset org pick any tenant.
    const orgId = this.resolveOrgId(req.user, body.organizationId);
    return this.schedulingService.scheduleSession({
      ...body,
      organizationId: orgId,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Post('reschedule')
  @Roles('HR_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async rescheduleSession(@Body() body: any, @Req() req: any) {
    const orgId = this.resolveOrgId(req.user, body.organizationId);
    return this.schedulingService.rescheduleSession(
      body.sessionId,
      new Date(body.scheduledAt),
      orgId,
    );
  }

  // Single place for the org-id resolution rule so both schedule paths
  // can't drift apart. SUPER_ADMIN may pass any org; everyone else is
  // locked to their own organizationId. Missing-and-not-admin is a
  // misconfiguration we want to fail loud, not silently.
  private resolveOrgId(user: any, bodyOrgId?: string): string {
    if (user.role === 'SUPER_ADMIN') {
      return bodyOrgId || user.organizationId;
    }
    if (!user.organizationId) {
      throw new ForbiddenException(
        'Your account has no organization assigned — contact an admin.',
      );
    }
    return user.organizationId;
  }
}
