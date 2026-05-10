import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaPipeService } from './mediapipe.service';
import { ImageProcessor } from '../../utils/image-processor';
import * as fs from 'fs';
import * as path from 'path';

export interface CaptureResult {
  success: boolean;
  capturePath?: string;
  captureId?: string;
  quality?: {
    isValid: boolean;
    brightness: number;
    sharpness: number;
    issues: string[];
  };
  faceDetected?: boolean;
  timestamp: Date;
}

interface CaptureMetadata {
  sessionId: string;
  captureType: 'ID_VERIFICATION' | 'PERIODIC' | 'EVENT_TRIGGERED' | 'MANUAL';
  timestamp: Date;
  faceCount: number;
  quality: any;
  checklistItemKey?: string;
}

@Injectable()
export class AutoCaptureService {
  private readonly logger = new Logger(AutoCaptureService.name);
  private readonly storagePath = process.env.STORAGE_PATH || './storage';
  private readonly capturesPath = path.join(this.storagePath, 'captures');
  private readonly periodicInterval = 120000; // 2 minutes
  private readonly lastPeriodicCapture = new Map<string, number>();

  constructor(
    private prismaService: PrismaService,
    private mediaPipeService: MediaPipeService,
  ) {
    // Ensure captures directory exists
    if (!fs.existsSync(this.capturesPath)) {
      fs.mkdirSync(this.capturesPath, { recursive: true });
    }
  }

  /**
   * Auto-capture during ID verification
   */
  async captureForIDVerification(
    sessionId: string,
    imageBase64: string,
    checklistItemKey: string
  ): Promise<CaptureResult> {
    try {
      this.logger.log(`Auto-capture for ID verification: Session ${sessionId}`);

      // Validate image quality
      const quality = await ImageProcessor.validateImageQuality(imageBase64);

      if (!quality.isValid) {
        this.logger.warn(`Poor image quality for session ${sessionId}: ${quality.issues.join(', ')}`);
        return {
          success: false,
          quality,
          faceDetected: false,
          timestamp: new Date(),
        };
      }

      // Detect face in image
      const faces = await this.mediaPipeService.detectFaces(imageBase64);
      const faceDetected = faces.length > 0;

      if (!faceDetected) {
        this.logger.warn(`No face detected in ID verification capture for session ${sessionId}`);
        return {
          success: false,
          quality,
          faceDetected: false,
          timestamp: new Date(),
        };
      }

      // Save capture
      const capturePath = await this.saveCapture(
        sessionId,
        imageBase64,
        'ID_VERIFICATION',
        checklistItemKey
      );

      // Store metadata in database
      const captureId = await this.storeCaptureMetadata({
        sessionId,
        captureType: 'ID_VERIFICATION',
        timestamp: new Date(),
        faceCount: faces.length,
        quality,
        checklistItemKey,
      });

      return {
        success: true,
        capturePath,
        captureId,
        quality,
        faceDetected: true,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`ID verification capture failed for session ${sessionId}:`, error.message);
      return {
        success: false,
        faceDetected: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Periodic auto-capture during exam
   */
  async capturePeriodicSnapshot(
    sessionId: string,
    imageBase64: string
  ): Promise<CaptureResult> {
    try {
      // Check if enough time has passed since last capture
      const lastCapture = this.lastPeriodicCapture.get(sessionId) || 0;
      const now = Date.now();

      if (now - lastCapture < this.periodicInterval) {
        return {
          success: false,
          faceDetected: false,
          timestamp: new Date(),
        };
      }

      // Validate quality (less strict for periodic captures)
      const quality = await ImageProcessor.validateImageQuality(imageBase64);

      // Detect face
      const faces = await this.mediaPipeService.detectFaces(imageBase64);
      const faceDetected = faces.length > 0;

      // Save capture even if quality is not perfect
      const capturePath = await this.saveCapture(
        sessionId,
        imageBase64,
        'PERIODIC'
      );

      // Store metadata
      const captureId = await this.storeCaptureMetadata({
        sessionId,
        captureType: 'PERIODIC',
        timestamp: new Date(),
        faceCount: faces.length,
        quality,
      });

      // Update last capture time
      this.lastPeriodicCapture.set(sessionId, now);

      this.logger.log(`Periodic capture saved for session ${sessionId}`);

      return {
        success: true,
        capturePath,
        captureId,
        quality,
        faceDetected,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Periodic capture failed for session ${sessionId}:`, error.message);
      return {
        success: false,
        faceDetected: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Event-triggered capture (on AI alert)
   */
  async captureOnEvent(
    sessionId: string,
    imageBase64: string,
    eventType: string
  ): Promise<CaptureResult> {
    try {
      this.logger.log(`Event-triggered capture for session ${sessionId}: ${eventType}`);

      // Quick quality check
      const quality = await ImageProcessor.validateImageQuality(imageBase64);

      // Detect faces
      const faces = await this.mediaPipeService.detectFaces(imageBase64);

      // Save capture
      const capturePath = await this.saveCapture(
        sessionId,
        imageBase64,
        'EVENT_TRIGGERED'
      );

      // Store metadata
      const captureId = await this.storeCaptureMetadata({
        sessionId,
        captureType: 'EVENT_TRIGGERED',
        timestamp: new Date(),
        faceCount: faces.length,
        quality,
      });

      return {
        success: true,
        capturePath,
        captureId,
        quality,
        faceDetected: faces.length > 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Event capture failed for session ${sessionId}:`, error.message);
      return {
        success: false,
        faceDetected: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Manual capture by proctor
   */
  async captureManual(
    sessionId: string,
    imageBase64: string
  ): Promise<CaptureResult> {
    try {
      this.logger.log(`Manual capture for session ${sessionId}`);

      const quality = await ImageProcessor.validateImageQuality(imageBase64);
      const faces = await this.mediaPipeService.detectFaces(imageBase64);

      const capturePath = await this.saveCapture(
        sessionId,
        imageBase64,
        'MANUAL'
      );

      const captureId = await this.storeCaptureMetadata({
        sessionId,
        captureType: 'MANUAL',
        timestamp: new Date(),
        faceCount: faces.length,
        quality,
      });

      return {
        success: true,
        capturePath,
        captureId,
        quality,
        faceDetected: faces.length > 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Manual capture failed for session ${sessionId}:`, error.message);
      return {
        success: false,
        faceDetected: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Save capture to disk
   */
  private async saveCapture(
    sessionId: string,
    imageBase64: string,
    captureType: string,
    checklistItemKey?: string
  ): Promise<string> {
    // Create session-specific directory
    const sessionDir = path.join(this.capturesPath, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Generate filename
    const timestamp = Date.now();
    const typePrefix = captureType.toLowerCase().replace(/_/g, '-');
    const itemSuffix = checklistItemKey ? `-${checklistItemKey}` : '';
    const filename = `${typePrefix}${itemSuffix}-${timestamp}.jpg`;
    const filepath = path.join(sessionDir, filename);

    // Compress image before saving
    const compressed = await ImageProcessor.compressImage(imageBase64, 85);

    // Save to disk
    const buffer = Buffer.from(
      compressed.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    fs.writeFileSync(filepath, buffer);

    // Create thumbnail
    const thumbnailPath = path.join(sessionDir, `thumb-${filename}`);
    const thumbnail = await ImageProcessor.createThumbnail(compressed, 150);
    const thumbBuffer = Buffer.from(
      thumbnail.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    fs.writeFileSync(thumbnailPath, thumbBuffer);

    return filepath;
  }

  /**
   * Store capture metadata in database
   */
  private async storeCaptureMetadata(metadata: CaptureMetadata): Promise<string> {
    // Store in FacialRecognitionLog for now
    // TODO: Create dedicated Capture table
    const log = await this.prismaService.facialRecognitionLog.create({
      data: {
        sessionId: metadata.sessionId,
        eventType: 'PERIODIC_CHECK', // Using existing enum
        capturedImagePath: '', // Will be updated
        similarityScore: 0,
        outcome: 'VERIFIED',
        faceCount: metadata.faceCount,
        detectionMethod: 'MEDIAPIPE',
        landmarkData: metadata.quality,
      },
    });

    return log.id;
  }

  /**
   * Get all captures for a session
   */
  async getSessionCaptures(sessionId: string): Promise<Array<{
    id: string;
    path: string;
    thumbnailPath: string;
    type: string;
    timestamp: Date;
    faceCount: number;
    quality: any;
  }>> {
    const sessionDir = path.join(this.capturesPath, sessionId);

    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const files = fs.readdirSync(sessionDir);
    const captures = files
      .filter(f => !f.startsWith('thumb-'))
      .map(filename => {
        const filepath = path.join(sessionDir, filename);
        const thumbnailPath = path.join(sessionDir, `thumb-${filename}`);
        const stats = fs.statSync(filepath);

        // Parse type from filename
        let type = 'UNKNOWN';
        if (filename.startsWith('id-verification')) type = 'ID_VERIFICATION';
        else if (filename.startsWith('periodic')) type = 'PERIODIC';
        else if (filename.startsWith('event-triggered')) type = 'EVENT_TRIGGERED';
        else if (filename.startsWith('manual')) type = 'MANUAL';

        return {
          id: filename,
          path: filepath,
          thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailPath : filepath,
          type,
          timestamp: stats.mtime,
          faceCount: 1, // TODO: Get from metadata
          quality: null,
        };
      });

    // Sort by timestamp (newest first)
    captures.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return captures;
  }

  /**
   * Delete old captures (retention policy)
   */
  async cleanupOldCaptures(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const sessions = fs.readdirSync(this.capturesPath);

      let deletedCount = 0;

      for (const sessionId of sessions) {
        const sessionDir = path.join(this.capturesPath, sessionId);
        const files = fs.readdirSync(sessionDir);

        for (const file of files) {
          const filepath = path.join(sessionDir, file);
          const stats = fs.statSync(filepath);

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }

        // Remove empty directories
        if (fs.readdirSync(sessionDir).length === 0) {
          fs.rmdirSync(sessionDir);
        }
      }

      this.logger.log(`Cleanup complete: Deleted ${deletedCount} old captures`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Get capture statistics
   */
  async getCaptureStats(sessionId: string): Promise<{
    totalCaptures: number;
    idVerificationCaptures: number;
    periodicCaptures: number;
    eventCaptures: number;
    manualCaptures: number;
    totalSize: number;
  }> {
    const captures = await this.getSessionCaptures(sessionId);

    const stats = {
      totalCaptures: captures.length,
      idVerificationCaptures: captures.filter(c => c.type === 'ID_VERIFICATION').length,
      periodicCaptures: captures.filter(c => c.type === 'PERIODIC').length,
      eventCaptures: captures.filter(c => c.type === 'EVENT_TRIGGERED').length,
      manualCaptures: captures.filter(c => c.type === 'MANUAL').length,
      totalSize: 0,
    };

    // Calculate total size
    for (const capture of captures) {
      if (fs.existsSync(capture.path)) {
        const stats = fs.statSync(capture.path);
        (stats as any).totalSize += stats.size;
      }
    }

    return stats;
  }
}
