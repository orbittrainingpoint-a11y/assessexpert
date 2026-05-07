import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async getQuestions(@Query() filters: any) {
    return this.questionsService.getQuestions(filters);
  }

  @Get('pool-stats/:assessmentTypeId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async getPoolStats(@Param('assessmentTypeId') id: string) {
    return this.questionsService.getPoolStats(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async getQuestion(@Param('id') id: string) {
    return this.questionsService.getQuestion(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async createQuestion(@Body() body: any, @Req() req: any) {
    return this.questionsService.createQuestion(body, req.user.id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async updateQuestion(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.questionsService.updateQuestion(id, body, req.user.id);
  }

  @Post(':id/archive')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async archiveQuestion(@Param('id') id: string) {
    return this.questionsService.archiveQuestion(id);
  }

  @Post('import')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  @UseInterceptors(FileInterceptor('file'))
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { assessmentTypeId: string },
    @Req() req: any,
  ) {
    // Parse CSV/Excel - simplified for now
    const rows = file.buffer.toString().split('\n').slice(1).map(row => {
      const cols = row.split(',');
      return {
        questionText: cols[0], optionA: cols[1], optionB: cols[2],
        optionC: cols[3], optionD: cols[4], correctAnswers: cols[5],
        difficulty: cols[6], domain: cols[7], explanation: cols[8],
      };
    }).filter(r => r.questionText);

    return this.questionsService.bulkImport(rows, body.assessmentTypeId, req.user.id);
  }
}
