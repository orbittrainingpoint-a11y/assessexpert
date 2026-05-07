import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { FacialRecognitionService } from './facial-recognition.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('facial-recognition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('facial-recognition')
export class FacialRecognitionController {
  constructor(private frService: FacialRecognitionService) {}

  @Post('sessions/:sessionId/pre-exam')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async runPreExamCheck(
    @Param('sessionId') sessionId: string,
    @Body() body: { capturedImage: string; referenceImage: string },
    @Req() req: any,
  ) {
    return this.frService.runPreExamCheck(sessionId, body.capturedImage, body.referenceImage, req.user.id);
  }

  @Post('sessions/:sessionId/periodic')
  async runPeriodicCheck(
    @Param('sessionId') sessionId: string,
    @Body() body: { capturedImage: string },
  ) {
    return this.frService.runPeriodicCheck(sessionId, body.capturedImage);
  }

  @Get('sessions/:sessionId/logs')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getLogs(@Param('sessionId') sessionId: string) {
    return this.frService.getFrLogs(sessionId);
  }
}
