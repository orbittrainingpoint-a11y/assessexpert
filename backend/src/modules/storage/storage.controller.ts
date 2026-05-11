import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as path from 'path';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  private toPublicUrl(filePath: string): string {
    // Convert "./storage/question-assets/foo.png" -> "/uploads/question-assets/foo.png"
    const base = path.resolve(process.env.STORAGE_PATH || './storage');
    const rel = path.relative(base, path.resolve(filePath)).replace(/\\/g, '/');
    return `/uploads/${rel}`;
  }

  @Post('upload/question-asset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadQuestionAsset(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    // Only allow image types for question assets
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!this.storageService.validateMimeType(file.buffer, allowed)) {
      throw new BadRequestException('Only JPG, PNG, GIF, WEBP images are allowed');
    }
    const filePath = await this.storageService.saveFile('question-assets', file.originalname, file.buffer);
    return {
      url: this.toPublicUrl(filePath),
      path: filePath,
      name: file.originalname,
      size: file.size,
    };
  }

  @Post('upload/practical-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPracticalFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const filePath = await this.storageService.saveFile('practical-files', file.originalname, file.buffer);
    return {
      url: this.toPublicUrl(filePath),
      path: filePath,
      name: file.originalname,
      size: file.size,
    };
  }
}
