import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard/stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('dashboard/activity')
  async getActivity(@Query() query: any) {
    return this.adminService.getActivityData(query.range || '30d', query.organizationId, query.assessmentTypeId);
  }

  @Get('settings')
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings/:key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: any }, @Req() req: any) {
    return this.adminService.updateSettings(key, body.value, req.user.id);
  }

  @Get('audit-log')
  async getAuditLog(@Query() filters: any) {
    return this.adminService.getAuditLog(filters);
  }

  @Post('reports/:id/comments')
  async addComment(@Param('id') id: string, @Body() body: { comment: string; type: string }, @Req() req: any) {
    return this.adminService.addReportComment(id, body.comment, body.type, req.user.id);
  }
}
