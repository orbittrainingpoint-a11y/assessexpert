import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PracticalSetsService } from './practical-sets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('practical-sets')
@Controller('practical-sets')
export class PracticalSetsController {
  constructor(
    private setsService: PracticalSetsService,
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  // ── Candidate-facing (public, by magic token) ──────────────────────────

  @Get('by-token')
  async getMySet(@Query('token') token: string, @Query('candidateId') candidateId?: string) {
    if (!token) throw new BadRequestException('token required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, candidateId: true, isMultiCandidate: true },
    });
    if (!session) throw new BadRequestException('Invalid token');
    if (session.isMultiCandidate && !candidateId) {
      throw new BadRequestException('candidateId is required for multi-candidate sessions');
    }
    return this.setsService.getAssignedSetForSession(session.id, candidateId);
  }

  @Post('answer')
  @UseInterceptors(FileInterceptor('file'))
  async submitAnswer(
    @Query('token') token: string,
    @Query('questionId') questionId: string,
    @Query('candidateId') candidateIdQuery: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { numericValue?: string; textValue?: string; candidateId?: string },
  ) {
    if (!token || !questionId) throw new BadRequestException('token & questionId required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, candidateId: true, isMultiCandidate: true },
    });
    if (!session) throw new BadRequestException('Invalid token');

    // Resolve candidate — multi-candidate slots MUST pass an id (via query
    // or multipart body), single-candidate falls back to the session's
    // primary so legacy callers keep working.
    let cId = candidateIdQuery || body.candidateId;
    if (session.isMultiCandidate && !cId) {
      throw new BadRequestException('candidateId is required for multi-candidate sessions');
    }
    if (!cId) cId = session.candidateId;
    if (cId !== session.candidateId) {
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId: session.id, candidateId: cId } },
        select: { id: true },
      });
      if (!sc) throw new BadRequestException('candidateId is not part of this session');
    }

    // body values come in as strings via multipart; coerce numericValue
    const numericValue = body.numericValue !== undefined && body.numericValue !== ''
      ? parseFloat(body.numericValue as any)
      : undefined;

    const result = await this.setsService.submitAnswer(session.id, cId, questionId, {
      file,
      numericValue: Number.isFinite(numericValue as number) ? numericValue : undefined,
      textValue: body.textValue,
    });

    // Tell proctor a question was answered, so they can see live progress
    this.gateway.emitToSession(session.id, 'practical.answerSubmitted', {
      sessionId: session.id,
      candidateId: cId,
      questionId,
      autoGraded: result.autoGraded,
      isCorrect: result.isCorrect,
    });

    return { submitted: true, autoGraded: result.autoGraded };
  }

  // ── Authenticated (Master Proctor / Exam Setup / Super Admin) ─────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async list(@Query('assessmentTypeId') assessmentTypeId?: string) {
    return this.setsService.listSets(assessmentTypeId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async getOne(@Param('id') id: string) {
    return this.setsService.getSet(id, { includeFiles: true, includeQuestions: true });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async create(@Body() body: any, @Req() req: any) {
    return this.setsService.createSet(body, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.setsService.updateSet(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/activate')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async activate(@Param('id') id: string) {
    return this.setsService.activateSet(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async remove(@Param('id') id: string) {
    return this.setsService.deleteSet(id);
  }

  // Files
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/files')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.setsService.addFile(id, file, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('files/:fileId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async deleteFile(@Param('fileId') fileId: string) {
    return this.setsService.deleteFile(fileId);
  }

  // Questions
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/questions')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async createQuestion(@Param('id') id: string, @Body() body: any) {
    return this.setsService.createQuestion(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('questions/:questionId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async updateQuestion(@Param('questionId') questionId: string, @Body() body: any) {
    return this.setsService.updateQuestion(questionId, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('questions/:questionId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async deleteQuestion(@Param('questionId') questionId: string) {
    return this.setsService.deleteQuestion(questionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/reorder')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async reorder(@Param('id') id: string, @Body() body: { orderedIds: string[] }) {
    return this.setsService.reorderQuestions(id, body.orderedIds);
  }

  // Assign a set to a session (proctor picks at exam time)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('sessions/:sessionId/assign')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR')
  async assignToSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { setId: string; candidateId?: string },
  ) {
    const result = await this.setsService.assignSetToSession(sessionId, body.setId, body.candidateId);
    // Notify the assigned candidate (or all candidates in multi-candidate session)
    this.gateway.emitToSession(sessionId, 'practical.setAssigned', {
      sessionId,
      setId: body.setId,
      candidateId: body.candidateId,
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  // List submitted answers (for grading view)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('sessions/:sessionId/answers')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR')
  async listAnswers(
    @Param('sessionId') sessionId: string,
    @Query('candidateId') candidateId?: string,
  ) {
    return this.setsService.listAnswers(sessionId, candidateId);
  }

  // Manually grade an answer
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('answers/:answerId/grade')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR')
  async grade(
    @Param('answerId') answerId: string,
    @Body() body: { marks?: number; graderNotes?: string },
    @Req() req: any,
  ) {
    return this.setsService.gradeAnswer(answerId, body, req.user.id);
  }
}
