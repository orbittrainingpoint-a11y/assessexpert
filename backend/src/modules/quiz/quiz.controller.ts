import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// HR-side: list quiz reports
@ApiTags('quiz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quiz')
export class QuizController {
  constructor(private quiz: QuizService) {}

  @Get('reports')
  @Roles('HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async listReports(@Req() req: any) {
    return this.quiz.listReportsForOrg(req.user.organizationId);
  }
}

// Candidate-side: public, magic-token authenticated.
@ApiTags('quiz-public')
@Controller('quiz/public')
export class QuizPublicController {
  constructor(private quiz: QuizService) {}

  @Get('by-token/:token')
  async getByToken(@Param('token') token: string) {
    return this.quiz.getByToken(token);
  }

  @Post(':token/send-otp')
  async sendOtp(@Param('token') token: string) {
    return this.quiz.sendOtp(token);
  }

  @Post(':token/verify-otp')
  async verifyOtp(@Param('token') token: string, @Body() body: { otp: string }) {
    return this.quiz.verifyOtp(token, body?.otp);
  }

  @Get(':token/questions')
  async getQuestions(@Param('token') token: string) {
    return this.quiz.getQuestions(token);
  }

  @Post(':token/submit')
  async submit(@Param('token') token: string, @Body() body: any) {
    return this.quiz.submit(token, body);
  }

  @Get(':token/report')
  async getReport(@Param('token') token: string) {
    return this.quiz.getReport(token);
  }
}
