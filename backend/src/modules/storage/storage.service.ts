import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private basePath = process.env.STORAGE_PATH || './storage';

  ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }

  async saveFile(subDir: string, originalName: string, buffer: Buffer): Promise<string> {
    const dir = path.join(this.basePath, subDir);
    this.ensureDir(dir);
    const ext = path.extname(originalName);
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  readFile(filePath: string): Buffer {
    return fs.readFileSync(filePath);
  }

  getFileSize(filePath: string): number {
    return fs.statSync(filePath).size;
  }

  validateMimeType(buffer: Buffer, allowedTypes: string[]): boolean {
    // Check magic bytes for common file types
    const hex = buffer.slice(0, 4).toString('hex');
    const mimeMap: Record<string, string> = {
      'ffd8ffe0': 'image/jpeg',
      'ffd8ffe1': 'image/jpeg',
      '89504e47': 'image/png',
      '25504446': 'application/pdf',
      '504b0304': 'application/zip',
    };
    const detected = mimeMap[hex] || 'application/octet-stream';
    return allowedTypes.includes(detected) || allowedTypes.includes('*');
  }

  initStorageDirs() {
    const dirs = [
      'recordings', 'reports', 'practical-files',
      'question-assets', 'temp', 'fr-images', 'id-photos',
    ];
    dirs.forEach(d => this.ensureDir(path.join(this.basePath, d)));
  }
}
