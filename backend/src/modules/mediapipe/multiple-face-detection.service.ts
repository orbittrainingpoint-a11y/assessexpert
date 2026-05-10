import { Injectable, Logger } from '@nestjs/common';
import { MediaPipeService } from '../mediapipe/mediapipe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProctoringService } from '../proctoring/proctoring.service';
import * as fs from 'fs';
import * as path from 'path';

interface MultipleFaceAlert {
  sessionId: string;
  faceCount: number;
  timestamp: Date;
  screenshotPath: string;
  boundingBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
}

@Injectable()
export class MultipleFaceDetectionService {
  private readonly logger = new Logger(MultipleFaceDetectionService.name);
  private readonly alertCooldown = new Map<string, number>(); // sessionId -> lastAlertTime
  private readonly cooldownPeriod = 5000; // 5 seconds between alerts
  private readonly minDetectionDuration = 2000; // 2 seconds minimum
  private readonly detectionBuffer = new Map<string, number[]>(); // sessionId -> timestamps

  constructor(
    private mediaPipeService: MediaPipeService,
    private prismaService: PrismaService,
    private proctoringService: ProctoringService,
  ) {}

  /**
   * Check for multiple faces in frame
   */
  async checkMultipleFaces(
    sessionId: string,
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ): Promise<{
    hasMultipleFaces: boolean;
    faceCount: number;
    shouldAlert: boolean;
  }> {
    try {
      // Detect faces
      const faces = await this.mediaPipeService.detectFaces(imageBase64);
      const faceCount = faces.length;
      const hasMultipleFaces = faceCount > 1;

      // Track detection over time
      if (hasMultipleFaces) {
        this.trackDetection(sessionId);
      } else {
        this.clearDetectionBuffer(sessionId);
      }

      // Check if we should alert
      const shouldAlert = this.shouldTriggerAlert(sessionId, hasMultipleFaces);

      if (shouldAlert) {
        await this.generateAlert(sessionId, faceCount, faces, imageBase64, emitAlert);
      }

      return {
        hasMultipleFaces,
        faceCount,
        shouldAlert,
      };
    } catch (error) {
      this.logger.error(`Multiple face check error for session ${sessionId}:`, error.message);
      return {
        hasMultipleFaces: false,
        faceCount: 0,
        shouldAlert: false,
      };
    }
  }

  /**
   * Track detection over time to avoid false positives
   */
  private trackDetection(sessionId: string) {
    const now = Date.now();
    const buffer = this.detectionBuffer.get(sessionId) || [];
    
    // Add current timestamp
    buffer.push(now);
    
    // Remove old timestamps (older than minDetectionDuration)
    const filtered = buffer.filter(ts => now - ts < this.minDetectionDuration);
    
    this.detectionBuffer.set(sessionId, filtered);
  }

  /**
   * Clear detection buffer
   */
  private clearDetectionBuffer(sessionId: string) {
    this.detectionBuffer.delete(sessionId);
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(sessionId: string, hasMultipleFaces: boolean): boolean {
    if (!hasMultipleFaces) return false;

    // Check detection duration
    const buffer = this.detectionBuffer.get(sessionId) || [];
    if (buffer.length < 3) return false; // Need at least 3 detections

    // Check cooldown
    const lastAlert = this.alertCooldown.get(sessionId) || 0;
    const now = Date.now();
    
    if (now - lastAlert < this.cooldownPeriod) {
      return false;
    }

    return true;
  }

  /**
   * Generate alert and notify proctor
   */
  private async generateAlert(
    sessionId: string,
    faceCount: number,
    faces: any[],
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ) {
    try {
      // Save screenshot with bounding boxes
      const screenshotPath = await this.saveAnnotatedScreenshot(
        sessionId,
        imageBase64,
        faces
      );

      // Log event to database
      await this.proctoringService.logEvent(sessionId, {
        eventType: 'FACE_MULTIPLE',
        severity: 'CRITICAL',
        source: 'AI',
        payload: {
          faceCount,
          boundingBoxes: faces.map(f => f.boundingBox),
          detectionMethod: 'MEDIAPIPE',
        },
        screenshotPath,
      });

      // Emit real-time alert to proctor via WebSocket
      emitAlert('ai.multiple_faces', {
        sessionId,
        faceCount,
        timestamp: new Date().toISOString(),
        screenshotPath,
        message: `${faceCount} faces detected in frame`,
        severity: 'CRITICAL',
      });

      // Update cooldown
      this.alertCooldown.set(sessionId, Date.now());

      this.logger.warn(`Multiple faces alert: Session ${sessionId}, Count: ${faceCount}`);
    } catch (error) {
      this.logger.error('Failed to generate alert:', error.message);
    }
  }

  /**
   * Save screenshot with bounding boxes drawn
   */
  private async saveAnnotatedScreenshot(
    sessionId: string,
    imageBase64: string,
    faces: any[]
  ): Promise<string> {
    const storagePath = process.env.STORAGE_PATH || './storage';
    const screenshotsPath = path.join(storagePath, 'ai-screenshots');
    
    if (!fs.existsSync(screenshotsPath)) {
      fs.mkdirSync(screenshotsPath, { recursive: true });
    }

    const filename = `${sessionId}-multiple-faces-${Date.now()}.jpg`;
    const filepath = path.join(screenshotsPath, filename);

    // For now, save original image
    // TODO: Draw bounding boxes using sharp or canvas
    const buffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    
    fs.writeFileSync(filepath, buffer);

    return filepath;
  }

  /**
   * Get face count for session
   */
  async getFaceCount(imageBase64: string): Promise<number> {
    return await this.mediaPipeService.countFaces(imageBase64);
  }

  /**
   * Check if candidate is present in frame
   */
  async isCandidatePresent(imageBase64: string): Promise<boolean> {
    const count = await this.getFaceCount(imageBase64);
    return count === 1;
  }

  /**
   * Detect absence from frame
   */
  async checkAbsence(
    sessionId: string,
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ): Promise<boolean> {
    const count = await this.getFaceCount(imageBase64);
    
    if (count === 0) {
      // Log absence event
      await this.proctoringService.logEvent(sessionId, {
        eventType: 'FACE_ABSENT',
        severity: 'CRITICAL',
        source: 'AI',
        payload: {
          detectionMethod: 'MEDIAPIPE',
        },
      });

      // Emit alert
      emitAlert('ai.face_absent', {
        sessionId,
        timestamp: new Date().toISOString(),
        message: 'Candidate not visible in frame',
        severity: 'CRITICAL',
      });

      return true;
    }

    return false;
  }

  /**
   * Clean up old cooldowns
   */
  cleanupCooldowns() {
    const now = Date.now();
    for (const [sessionId, timestamp] of this.alertCooldown.entries()) {
      if (now - timestamp > 60000) { // 1 minute
        this.alertCooldown.delete(sessionId);
        this.detectionBuffer.delete(sessionId);
      }
    }
  }
}
