import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class RecordingsService {
  private signedUrls = new Map<string, { path: string; expires: Date }>();

  constructor(private prisma: PrismaService) {}

  async saveChunk(sessionId: string, streamType: 'screen' | 'webcam', chunkIndex: number, buffer: Buffer) {
    const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
    const sessionDir = path.join(storagePath, sessionId);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const chunkPath = path.join(sessionDir, `${streamType}-chunk-${chunkIndex}.webm`);
    fs.writeFileSync(chunkPath, buffer);
    return { saved: true, chunkPath };
  }

  async finalizeRecording(sessionId: string) {
    const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
    const sessionDir = path.join(storagePath, sessionId);

    // Merge chunks into final files
    for (const streamType of ['screen', 'webcam']) {
      const chunks = fs.existsSync(sessionDir)
        ? fs.readdirSync(sessionDir).filter(f => f.startsWith(`${streamType}-chunk`)).sort()
        : [];

      if (chunks.length > 0) {
        const finalPath = path.join(sessionDir, `${streamType}.webm`);
        const writeStream = fs.createWriteStream(finalPath);
        for (const chunk of chunks) {
          const data = fs.readFileSync(path.join(sessionDir, chunk));
          writeStream.write(data);
          fs.unlinkSync(path.join(sessionDir, chunk)); // Remove chunk after merging
        }
        writeStream.end();

        const fieldName = streamType === 'screen' ? 'screenRecordingPath' : 'webcamRecordingPath';
        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: {
            [fieldName]: finalPath,
            recordingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  async getRecordingUrl(sessionId: string, requestingUser: any): Promise<{ url: string; expiresAt: string }> {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    // Tenant isolation
    if (!['SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR'].includes(requestingUser.role)) {
      if (session.organizationId !== requestingUser.organizationId) throw new ForbiddenException('Access denied');
    }

    if (session.recordingPurged) throw new ForbiddenException('Recording has been purged (7-day retention expired)');
    if (!session.screenRecordingPath) throw new NotFoundException('Recording not available');

    // Generate signed token (2-hour expiry)
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    this.signedUrls.set(token, { path: session.screenRecordingPath, expires });

    return {
      url: `/api/recordings/stream/${token}`,
      expiresAt: expires.toISOString(),
    };
  }

  async streamRecording(token: string): Promise<{ filePath: string }> {
    const entry = this.signedUrls.get(token);
    if (!entry || entry.expires < new Date()) {
      this.signedUrls.delete(token);
      throw new ForbiddenException('Recording link has expired');
    }
    if (!fs.existsSync(entry.path)) throw new NotFoundException('Recording file not found');
    return { filePath: entry.path };
  }

  async getRecordingStatus(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { screenRecordingPath: true, webcamRecordingPath: true, recordingExpiresAt: true, recordingPurged: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const daysRemaining = session.recordingExpiresAt
      ? Math.max(0, Math.ceil((session.recordingExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      available: !session.recordingPurged && !!session.screenRecordingPath,
      purged: session.recordingPurged,
      expiresAt: session.recordingExpiresAt,
      daysRemaining,
    };
  }

  // Every 2 hours — find sessions that were recording but never had their
  // chunks merged (browser slammed shut, finalize POST lost, server
  // restarted mid-session). For each, if there are chunk files on disk
  // older than 30 minutes and the session is now in a terminal state OR
  // hasn't been touched in 2h, merge them.
  @Cron('0 */2 * * *')
  async finalizeOrphanRecordings() {
    const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
    if (!fs.existsSync(storagePath)) return;

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const candidates = await this.prisma.examSession.findMany({
      where: {
        OR: [
          { status: { in: ['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'DISQUALIFIED', 'NO_SHOW', 'CANCELLED'] } },
          { updatedAt: { lt: twoHoursAgo } },
        ],
        screenRecordingPath: null,
        webcamRecordingPath: null,
        recordingPurged: false,
      },
      select: { id: true },
    });

    let recovered = 0;
    for (const session of candidates) {
      const dir = path.join(storagePath, session.id);
      if (!fs.existsSync(dir)) continue;
      const chunks = fs.readdirSync(dir).filter(f => f.includes('-chunk-'));
      if (chunks.length === 0) continue;

      // Only merge if the newest chunk is at least 5 minutes old — gives
      // an active session time to keep writing without us racing.
      const newest = chunks
        .map(f => fs.statSync(path.join(dir, f)).mtimeMs)
        .reduce((a, b) => Math.max(a, b), 0);
      if (Date.now() - newest < 5 * 60 * 1000) continue;

      try {
        await this.finalizeRecording(session.id);
        recovered++;
      } catch (e) {
        console.warn(`Orphan finalize failed for ${session.id}:`, (e as any)?.message);
      }
    }
    if (recovered > 0) console.log(`Orphan recording sweep merged ${recovered} session(s).`);
  }

  // Daily cron at 3 AM — purge expired recordings
  @Cron('0 3 * * *')
  async purgeExpiredRecordings() {
    const expired = await this.prisma.examSession.findMany({
      where: {
        recordingPurged: false,
        recordingExpiresAt: { lt: new Date() },
        screenRecordingPath: { not: null },
      },
    });

    for (const session of expired) {
      try {
        const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
        const sessionDir = path.join(storagePath, session.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        await this.prisma.examSession.update({
          where: { id: session.id },
          data: { recordingPurged: true, screenRecordingPath: null, webcamRecordingPath: null },
        });
        console.log(`Purged recording for session ${session.id}`);
      } catch (e) {
        console.error(`Failed to purge recording for session ${session.id}:`, e.message);
      }
    }

    console.log(`Recording purge complete. Purged ${expired.length} sessions.`);
  }
}
