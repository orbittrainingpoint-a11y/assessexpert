import { Injectable, Logger, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaPipeService } from '../mediapipe/mediapipe.service';
import { AppGateway } from '../gateway/app.gateway';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FacialRecognitionService {
  private readonly logger = new Logger(FacialRecognitionService.name);

  constructor(
    private prisma: PrismaService,
    private mediaPipeService: MediaPipeService,
    private gateway: AppGateway,
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

  async runPreExamCheck(sessionId: string, capturedImageBase64: string, referenceImageBase64: string, proctorId: string, candidateId?: string) {
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
        candidateId: candidateId || null,
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

  // Candidate-browser periodic check (magic-token authed). Compares the
  // freshly captured frame against the candidate's persisted reference
  // embedding on CandidateRecord rather than the in-session PRE_EXAM_ID
  // log, so this works even when no proctor pre-exam capture was taken
  // (e.g. drop-in HR self-service flows). Emits a socket event to the
  // proctor room when the outcome is anything other than VERIFIED.
  async runCandidatePeriodicCheck(
    sessionId: string,
    candidateId: string,
    capturedImageBase64: string,
  ) {
    const storagePath = process.env.STORAGE_PATH || './storage';
    const frPath = path.join(storagePath, 'fr-images');
    if (!fs.existsSync(frPath)) fs.mkdirSync(frPath, { recursive: true });

    const capturedPath = path.join(frPath, `${sessionId}-${candidateId}-periodic-${Date.now()}.jpg`);
    fs.writeFileSync(capturedPath, Buffer.from(capturedImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));

    // compareAgainstReference already handles "no reference photo" and
    // "no face detected" with REJECTED outcomes so we don't have to
    // duplicate that here. similarity is a 0..100 number.
    const { similarity, outcome, reason } = await this.compareAgainstReference(
      capturedImageBase64,
      candidateId,
    );

    const log = await this.prisma.facialRecognitionLog.create({
      data: {
        sessionId,
        candidateId,
        eventType: 'PERIODIC_CHECK',
        capturedImagePath: capturedPath,
        similarityScore: similarity,
        outcome,
        reviewNotes: reason || null,
        detectionMethod: 'MEDIAPIPE',
      },
    });

    // Live-flag the proctor on anything other than a clean VERIFIED so
    // they can act on a face mismatch / missing face before the exam ends.
    if (outcome !== 'VERIFIED') {
      try {
        this.gateway.emitToSession(sessionId, 'fr.periodic.flag', {
          sessionId,
          candidateId,
          similarity,
          outcome,
          reason: reason || null,
          timestamp: log.timestamp,
        });
      } catch (e) {
        this.logger.warn(`Failed to emit fr.periodic.flag: ${(e as Error).message}`);
      }
    }

    return { similarity, outcome, reason };
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

    // Resolve the candidate this log belongs to — falls back to the
    // session's primary so single-candidate sessions keep working.
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true },
    });

    return this.prisma.facialRecognitionLog.create({
      data: {
        sessionId,
        candidateId: session?.candidateId || null,
        eventType: 'PERIODIC_CHECK',
        capturedImagePath: capturedPath,
        similarityScore: similarity,
        outcome,
        faceEmbedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null,
        detectionMethod: 'MEDIAPIPE',
      },
    });
  }

  // Magic-token resolver shared by candidate-side endpoints. Validates
  // the token matches the session and resolves the candidateId (required
  // for multi-candidate slots, falls back to primary otherwise).
  async resolveCandidateFromToken(token: string, sessionId: string, candidateId?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, candidateId: true, isMultiCandidate: true, status: true },
    });
    if (!session || session.id !== sessionId) {
      throw new UnauthorizedException('Invalid token for this session');
    }
    // Only allow during exam-active phases — there's no reason for the
    // candidate browser to be capturing frames at any other time.
    const allowed = ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'];
    if (!allowed.includes(session.status)) {
      throw new BadRequestException(`Periodic FR check not allowed in status ${session.status}`);
    }
    if (session.isMultiCandidate && !candidateId) {
      throw new BadRequestException('candidateId is required for multi-candidate sessions');
    }
    let cId = candidateId || session.candidateId;
    if (cId !== session.candidateId) {
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        select: { id: true },
      });
      if (!sc) throw new UnauthorizedException('candidateId is not part of this session');
    }
    return { sessionId, candidateId: cId };
  }

  async getFrLogs(sessionId: string) {
    return this.prisma.facialRecognitionLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
