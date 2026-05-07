import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('upload/question-asset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadQuestionAsset(@UploadedFile() file: Express.Multer.File) {
    const filePath = await this.storageService.saveFile('question-assets', file.originalname, file.buffer);
    return { path: filePath, name: file.originalname, size: file.size };
  }

  @Post('upload/practical-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPracticalFile(@UploadedFile() file: Express.Multer.File) {
    const filePath = await this.storageService.saveFile('practical-files', file.originalname, file.buffer);
    return { path: filePath, name: file.originalname, size: file.size };
  }
}
