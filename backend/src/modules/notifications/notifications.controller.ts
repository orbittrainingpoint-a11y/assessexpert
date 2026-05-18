import { Controller, ForbiddenException, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.id);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('mark-all-read')
  async markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  // SUPER_ADMIN-only — surfaces recent SMTP failures so the operator can
  // catch outage windows without grepping pm2 logs.
  @Get('email-health')
  async getEmailHealth(@Req() req: any) {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return this.notificationsService.getEmailHealth();
  }
}
