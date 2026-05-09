import { Controller, Get, Post, Body, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamDeliveryService } from './exam-delivery.service';
import { AppGateway } from '../gateway/app.gateway';
import { ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('exam')
@Controller('exam')
export class ExamDeliveryController {
  constructor(
    private examDeliveryService: ExamDeliveryService,
    private gateway: AppGateway,
  ) {}

  @Get('session')
  async getSessionState(@Query('token') token: string) {
    return this.examDeliveryService.getSessionState(token);
  }

  @Get('question/current')
  async getCurrentQuestion(@Query('token') token: string) {
    return this.examDeliveryService.getCurrentQuestion(token);
  }

  @Post('question/submit')
  async submitAnswer(
    @Query('token') token: string,
    @Body() body: { questionId: string; response: any; timeSpentSeconds: number },
  ) {
    return this.examDeliveryService.submitAnswer(token, body.questionId, body.response, body.timeSpentSeconds);
  }

  @Get('timer')
  async getTimer(@Query('token') token: string) {
    return this.examDeliveryService.getTimer(token);
  }

  @Get('practical/task')
  async getPracticalTask(@Query('token') token: string) {
    return this.examDeliveryService.getPracticalTask(token);
  }

  @Post('practical/submit')
  @UseInterceptors(FileInterceptor('file'))
  async submitPractical(
    @Query('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let filePath: string | undefined;
    let fileName: string | undefined;

    if (file) {
      const storagePath = process.env.PRACTICAL_FILES_PATH || './storage/practical-files';
      if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
      fileName = `${Date.now()}-${file.originalname}`;
      filePath = path.join(storagePath, fileName);
      fs.writeFileSync(filePath, file.buffer);
    }

    const result = await this.examDeliveryService.submitPractical(token, filePath, fileName);
    // Notify proctor that candidate submitted
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (session) this.gateway.emitToSession(session.id, 'session.submitted', { sessionId: session.id, timestamp: new Date().toISOString() });
    return result;
  }
}
