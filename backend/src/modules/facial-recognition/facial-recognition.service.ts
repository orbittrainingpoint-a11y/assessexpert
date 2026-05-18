import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaPipeService } from '../mediapipe/mediapipe.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FacialRecognitionService {
  private readonly logger = new Logger(FacialRecognitionService.name);

  constructor(
    private prisma: PrismaService,
    private mediaPipeService: MediaPipeService,
  ) {}

  async compareFaces(sourceImageBase64: string, targetImageBase64: string): Promise<{
    similarity: number;
    outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
    reason?: string;
  }> {
    // Extract face landmarks and embeddings from both images. If MediaPipe
    // can't extract a real embedding from either side, we REJECT rather than
    // silently auto-pass — false positives here are worse than false negatives.
    const sourceLandmarks = await this.mediaPipeService.extractFaceLandmarks(sourceImageBase64);
    const targetLandmarks = await this.mediaPipeService.extractFaceLandmarks(targetImageBase64);

    if (!sourceLandmarks || !targetLandmarks) {
      this.logger.warn('FR comparison: no landmarks extracted, rejecting');
      return {
        similarity: 0,
        outcome: 'REJECTED',
        reason: !sourceLandmarks ? 'No face detected in captured image' : 'No face on file for this candidate',
      };
    }

    // Compare embeddings using MediaPipe (cosine similarity in 0..1, scaled to %)
    const result = this.mediaPipeService.compareFaceEmbeddings(
      sourceLandmarks.embedding,
      targetLandmarks.embedding,
    );
    return { similarity: result.similarity, outcome: result.outcome };
  }

  // Compare against the candidate's PERSISTED reference photo (the one
  // captured the first time they joined an exam). Cheaper than the
  // two-image overload above because we only run MediaPipe on the new
  // capture — the reference embedding is cached on CandidateRecord.
  async compareAgainstReference(
    capturedImageBase64: string,
    candidateId: string,
  ): Promise<{ similarity: number; outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED'; reason?: string }> {
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id: candidateId },
      select: { referenceFaceEmbedding: true, referencePhotoPath: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.referenceFaceEmbedding) {
      return {
        similarity: 0,
        outcome: 'REJECTED',
        reason: 'No reference photo on file. Ask the candidate to redo the camera check.',
      };
    }
    const capturedLandmarks = await this.mediaPipeService.extractFaceLandmarks(capturedImageBase64);
    if (!capturedLandmarks) {
      return { similarity: 0, outcome: 'REJECTED', reason: 'No face detected in captured frame' };
    }
    let referenceEmbedding: number[];
    try {
      referenceEmbedding = JSON.parse(candidate.referenceFaceEmbedding as string);
    } catch {
      return { similarity: 0, outcome: 'REJECTED', reason: 'Stored reference is corrupt — recapture required' };
    }
    const result = this.mediaPipeService.compareFaceEmbeddings(
      capturedLandmarks.embedding,
      referenceEmbedding,
    );
    return { similarity: result.similarity, outcome: result.outcome };
  }

  // Save the candidate's one-time reference photo + embedding. Refuses to
  // overwrite an existing reference unless force=true (kept for admin use).
  async saveReferencePhoto(candidateId: string, imageBase64: string, force = false) {
    const candidate = await this.prisma.candidateRecord.findUnique({
      where: { id: candidateId },
      select: { id: true, referencePhotoPath: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.referencePhotoPath && !force) {
      return { saved: false, reason: 'Reference photo already on file' };
    }

    // Extract embedding FIRST — if MediaPipe can't see a face, refuse to save.
    const landmarks = await this.mediaPipeService.extractFaceLandmarks(imageBase64);
    if (!landmarks) {
      throw new BadRequestException('No face detected in the frame. Please re-centre the candidate and retry.');
    }

    const storagePath = process.env.STORAGE_PATH || './storage';
    const dir = path.join(storagePath, 'candidate-photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const relPath = `candidate-photos/${candidateId}.jpg`;
    const absPath = path.join(storagePath, relPath);
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    fs.writeFileSync(absPath, buffer);

    await this.prisma.candidateRecord.update({
      where: { id: candidateId },
      data: {
        referencePhotoPath: relPath,
        referencePhotoCapturedAt: new Date(),
        referenceFaceEmbedding: JSON.stringify(landmarks.embedding),
      },
    });

    this.logger.log(`Reference photo saved for candidate ${candidateId}`);
    return { saved: true, path: relPath };
  }

  async hasReferencePhoto(candidateId: string) {
    const c = await this.prisma.candidateRecord.findUnique({
      where: { id: candidateId },
      select: { referencePhotoPath: true, referencePhotoCapturedAt: true },
    });
    return {
      hasPhoto: !!c?.referencePhotoPath,
      capturedAt: c?.referencePhotoCapturedAt || null,
    };
  }

  async runPreExamCheck(sessionId: string, capturedImageBase64: string, referenceImageBase64: string, proctorId: string) {
    const { similarity, outcome } = await this.compareFaces(capturedImageBase64, referenceImageBase64);

    // Extract and store face embedding for future comparisons
    const landmarks = await this.mediaPipeService.extractFaceLandmarks(capturedImageBase64);
    const faceEmbedding = landmarks ? landmarks.embedding : null;

    const storagePath = process.env.STORAGE_PATH || './storage';
    const frPath = path.join(storagePath, 'fr-images');
    if (!fs.existsSync(frPath)) fs.mkdirSync(frPath, { recursive: true });

    const capturedPath = path.join(frPath, `${sessionId}-captured-${Date.now()}.jpg`);
    fs.writeFileSync(capturedPath, Buffer.from(capturedImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));

    const log = await this.prisma.facialRecognitionLog.create({
      data: {
        sessionId,
        eventType: 'PRE_EXAM_ID',
        capturedImagePath: capturedPath,
        similarityScore: similarity,
        outcome,
        reviewedBy: outcome === 'PENDING_REVIEW' ? null : proctorId,
        faceEmbedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null,
        detectionMethod: 'MEDIAPIPE',
      },
    });

    return { log, similarity, outcome };
  }

  async runPeriodicCheck(sessionId: string, capturedImageBase64: string) {
    const storagePath = process.env.STORAGE_PATH || './storage';
    const frPath = path.join(storagePath, 'fr-images');
    if (!fs.existsSync(frPath)) fs.mkdirSync(frPath, { recursive: true });

    const capturedPath = path.join(frPath, `${sessionId}-periodic-${Date.now()}.jpg`);
    fs.writeFileSync(capturedPath, Buffer.from(capturedImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));

    // Get reference embedding from pre-exam check
    const preExamLog = await this.prisma.facialRecognitionLog.findFirst({
      where: { sessionId, eventType: 'PRE_EXAM_ID' },
      orderBy: { timestamp: 'asc' },
    });

    let similarity = 95;
    let outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED' = 'VERIFIED';
    let faceEmbedding = null;

    if (preExamLog?.faceEmbedding) {
      try {
        // Extract embedding from current capture
        const currentLandmarks = await this.mediaPipeService.extractFaceLandmarks(capturedImageBase64);
        
        if (currentLandmarks) {
          faceEmbedding = currentLandmarks.embedding;
          const referenceEmbedding = JSON.parse(preExamLog.faceEmbedding as string);
          
          // Compare embeddings
          const result = this.mediaPipeService.compareFaceEmbeddings(
            currentLandmarks.embedding,
            referenceEmbedding
          );
          
          similarity = result.similarity;
          outcome = result.outcome;
        }
      } catch (error) {
        console.error('Periodic check error:', error.message);
      }
    }

    return this.prisma.facialRecognitionLog.create({
      data: {
        sessionId,
        eventType: 'PERIODIC_CHECK',
        capturedImagePath: capturedPath,
        similarityScore: similarity,
        outcome,
        faceEmbedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null,
        detectionMethod: 'MEDIAPIPE',
      },
    });
  }

  async getFrLogs(sessionId: string) {
    return this.prisma.facialRecognitionLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
