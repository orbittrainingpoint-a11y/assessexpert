import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { GradingService } from './grading.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('grading')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grading')
export class GradingController {
  constructor(private gradingService: GradingService) {}

  @Get('sessions/:sessionId/mcq')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getMcqSummary(@Param('sessionId') sessionId: string) {
    return this.gradingService.getMcqSummary(sessionId);
  }

  @Post('sessions/:sessionId/grade-mcq')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async gradeMcq(@Param('sessionId') sessionId: string) {
    return this.gradingService.gradeMcq(sessionId);
  }
}
