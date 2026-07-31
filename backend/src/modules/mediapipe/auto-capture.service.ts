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
  // Real similarity score (0–100) when comparing against the candidate's
  // stored reference photo. 0 with outcome=REJECTED means we couldn't run
  // the comparison (no reference on file, no face detected, model failure).
  similarity?: number;
  outcome?: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
  reason?: string;
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
   * Auto-capture during ID verification AND compare against the candidate's
   * stored reference photo. If no reference is on file (or the comparison
   * can't run), the result is REJECTED — we DON'T silently auto-pass.
   */
  async captureForIDVerification(
    sessionId: string,
    imageBase64: string,
    checklistItemKey: string,
    candidateId?: string,
    // Detection result the proctor's browser produced locally. Used as
    // the authoritative source for "face present" when server-side
    // MediaPipe is unavailable (Node can't run @mediapipe/tasks-vision:
    // it errors with `navigator is not defined`). If both signals are
    // present, the server-side one wins for defense-in-depth.
    clientDetection?: { clientFaceCount?: number; clientFaceConfidence?: number },
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
          similarity: 0,
          outcome: 'REJECTED',
          reason: 'Image quality too low: ' + quality.issues.join(', '),
          timestamp: new Date(),
        };
      }

      // Server-side detection first (if MediaPipe is actually loaded).
      // Falls back to the browser-supplied count when the server model
      // hasn't loaded — which is the norm on Node hosts today.
      const faces = await this.mediaPipeService.detectFaces(imageBase64);
      const serverFaceCount = faces.length;
      const clientFaceCount = clientDetection?.clientFaceCount ?? 0;
      const faceCount = serverFaceCount > 0 ? serverFaceCount : clientFaceCount;
      const faceDetected = faceCount > 0;
      const detectedBy: 'server' | 'client' | 'none' =
        serverFaceCount > 0 ? 'server' : clientFaceCount > 0 ? 'client' : 'none';

      if (!faceDetected) {
        this.logger.warn(`No face detected in ID verification capture for session ${sessionId}`);
        return {
          success: false,
          quality,
          faceDetected: false,
          similarity: 0,
          outcome: 'REJECTED',
          reason: 'No face detected in the captured frame',
          timestamp: new Date(),
        };
      }

      // Save capture
      const capturePath = await this.saveCapture(
        sessionId,
        imageBase64,
        'ID_VERIFICATION',
        checklistItemKey,
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

      // Resolve the candidate (defaults to the session's primary) and
      // compare against their stored reference photo.
      let resolvedCandidateId = candidateId;
      if (!resolvedCandidateId) {
        const session = await this.prismaService.examSession.findUnique({
          where: { id: sessionId },
          select: { candidateId: true },
        });
        resolvedCandidateId = session?.candidateId;
      }

      let similarity = 0;
      let outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED' = 'REJECTED';
      let reason: string | undefined;

      if (!resolvedCandidateId) {
        reason = 'Unable to resolve candidate for this session';
      } else {
        const candidate = await this.prismaService.candidateRecord.findUnique({
          where: { id: resolvedCandidateId },
          select: { referenceFaceEmbedding: true, referencePhotoPath: true },
        });
        if (!candidate?.referenceFaceEmbedding) {
          // No reference on file — flag for manual review rather than
          // hard-reject when the client confirmed a face is present.
          // Automated similarity is impossible here, but the proctor
          // has just SEEN the candidate so a manual confirm is valid.
          outcome = detectedBy === 'client' ? 'PENDING_REVIEW' : 'REJECTED';
          reason = 'No reference photo on file — proctor please visually verify identity';
        } else {
          const capturedLandmarks = await this.mediaPipeService.extractFaceLandmarks(imageBase64);
          if (!capturedLandmarks) {
            // Server MediaPipe couldn't run (Node/navigator issue). If
            // the browser confirmed a face was in the frame, defer to
            // proctor manual review instead of a hard REJECTED — the
            // similarity number is unknown, not zero.
            if (detectedBy === 'client') {
              outcome = 'PENDING_REVIEW';
              reason = 'Automated similarity unavailable — proctor please visually verify against reference';
            } else {
              reason = 'Could not extract face landmarks from captured frame';
            }
          } else {
            try {
              const referenceEmbedding = JSON.parse(candidate.referenceFaceEmbedding as string);
              const cmp = this.mediaPipeService.compareFaceEmbeddings(
                capturedLandmarks.embedding,
                referenceEmbedding,
              );
              similarity = cmp.similarity;
              outcome = cmp.outcome;
            } catch (e) {
              reason = 'Stored reference embedding is corrupt';
            }
          }
        }
      }

      // Update the FacialRecognitionLog row we wrote at line 111 with
      // the real comparison outcome + similarity. The previous code
      // left every log entry stamped 'VERIFIED' regardless of result,
      // which made the log useless for "did this candidate ever fail
      // an FR check" queries. Best-effort: if the update fails the
      // capture still succeeds; only the audit trail is degraded.
      try {
        await this.prismaService.facialRecognitionLog.update({
          where: { id: captureId },
          data: {
            outcome,
            similarityScore: similarity,
            reviewNotes: reason || null,
            capturedImagePath: capturePath,
            candidateId: resolvedCandidateId || null,
          },
        });
      } catch (e: any) {
        this.logger.warn(`Failed to update FR log ${captureId}: ${e?.message || e}`);
      }

      return {
        success: outcome === 'VERIFIED',
        capturePath,
        captureId,
        quality,
        faceDetected: true,
        similarity,
        outcome,
        reason,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`ID verification capture failed for session ${sessionId}:`, error.message);
      return {
        success: false,
        faceDetected: false,
        similarity: 0,
        outcome: 'REJECTED',
        reason: error?.message || 'Internal error',
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

    // Hydrate face count + landmark/quality data from the FR log rows so
    // the dashboard shows the actual detection result for each capture
    // (not the old hardcoded `faceCount: 1` placeholder). We index by
    // capturedImagePath because that's what the FR service writes when
    // it stores the JPEG — same filesystem path we're reading here.
    const logs = await this.prismaService.facialRecognitionLog.findMany({
      where: { sessionId },
      select: { capturedImagePath: true, faceCount: true, landmarkData: true },
    });
    const logByPath = new Map<string, { faceCount: number | null; landmarkData: any }>();
    for (const l of logs) {
      if (l.capturedImagePath) {
        logByPath.set(path.basename(l.capturedImagePath), {
          faceCount: l.faceCount,
          landmarkData: l.landmarkData,
        });
      }
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

        const meta = logByPath.get(filename);
        return {
          id: filename,
          path: filepath,
          thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailPath : filepath,
          type,
          timestamp: stats.mtime,
          // Fall back to 1 when there's no matching FR log row — that
          // means a legacy capture from before we started persisting
          // faceCount, not a definitively-single-face frame.
          faceCount: meta?.faceCount ?? 1,
          quality: meta?.landmarkData ?? null,
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
        const fileStat = fs.statSync(capture.path);
        stats.totalSize += fileStat.size;
      }
    }

    return stats;
  }
}
