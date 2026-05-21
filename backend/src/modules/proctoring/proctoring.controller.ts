import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ProctoringService } from './proctoring.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('proctoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proctoring')
export class ProctoringController {
  constructor(private proctoringService: ProctoringService) {}

  @Post('events')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async logEvent(@Body() body: any) {
    return this.proctoringService.logEvent(body.sessionId, body);
  }

  @Get('events/:sessionId')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getEvents(@Param('sessionId') sessionId: string) {
    return this.proctoringService.getEvents(sessionId);
  }

  @Put('events/:eventId/review')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async reviewFlag(
    @Param('eventId') eventId: string,
    @Body() body: { outcome: string; note: string },
    @Req() req: any,
  ) {
    return this.proctoringService.reviewFlag(eventId, body.outcome, body.note, req.user.id);
  }

  @Post('sessions/:sessionId/warn')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async sendWarning(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    return this.proctoringService.sendWarning(sessionId, body.message, req.user.id);
  }

  @Get('sessions/:sessionId/integrity')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getIntegrity(@Param('sessionId') sessionId: string) {
    const score = await this.proctoringService.getIntegrityScore(sessionId);
    return { score };
  }
}
