import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { QuizService } from './quiz.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
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

  /** Per-report Q&A detail — every question, candidate's choice, correct
   *  choice, marks. Org-scoped. */
  @Get('reports/:id')
  @Roles('HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async getReportDetail(@Param('id') id: string, @Req() req: any) {
    return this.quiz.getReportDetail(id, req.user.organizationId);
  }

  /** Branded PDF of the quiz report. Streams the binary directly so the
   *  browser triggers a download (Content-Disposition: attachment). */
  @Get('reports/:id/pdf')
  @Roles('HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN')
  async getReportPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const { buffer, filename } = await this.quiz.generateReportPdf(id, req.user.organizationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
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

  @Post(':token/confirm-email')
  async confirmEmail(@Param('token') token: string, @Body() body: { email: string }) {
    return this.quiz.confirmEmail(token, body?.email);
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

  // SAST P1 #8 — was @Body() body: any. Now validated by SubmitQuizDto
  // via the global ValidationPipe (whitelist + transform). Malformed
  // input is rejected with a clean 400 instead of crashing deeper
  // and leaking a stack trace.
  @Post(':token/submit')
  async submit(@Param('token') token: string, @Body() body: SubmitQuizDto) {
    return this.quiz.submit(token, body);
  }

  @Get(':token/report')
  async getReport(@Param('token') token: string) {
    return this.quiz.getReport(token);
  }
}
