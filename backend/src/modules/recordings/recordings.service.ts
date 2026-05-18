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

  // PER-CANDIDATE chunk save. Chunks live at:
  //   {RECORDINGS_PATH}/{sessionId}/{candidateId}/{webcam|screen}-chunk-{N}.webm
  //
  // candidateId is required. For single-candidate sessions the controller
  // passes session.candidateId; for multi-candidate slots the candidate
  // browser passes its OTP-resolved candidateId via the upload query.
  async saveChunk(
    sessionId: string,
    candidateId: string,
    streamType: 'screen' | 'webcam',
    chunkIndex: number,
    buffer: Buffer,
  ) {
    const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
    const candidateDir = path.join(storagePath, sessionId, candidateId);
    if (!fs.existsSync(candidateDir)) fs.mkdirSync(candidateDir, { recursive: true });

    const chunkPath = path.join(candidateDir, `${streamType}-chunk-${chunkIndex}.webm`);
    fs.writeFileSync(chunkPath, buffer);
    return { saved: true, chunkPath };
  }

  // Finalize for ONE candidate. Merges that candidate's chunks into
  // {sessionId}/{candidateId}/{stream}.webm. Single-candidate sessions
  // mirror the path onto ExamSession.{screen,webcam}RecordingPath so
  // existing HR/proctor queries keep working unchanged. Multi-candidate
  // slots write only to SessionCandidate.{screen,webcam}RecordingPath.
  async finalizeRecordingForCandidate(sessionId: string, candidateId: string) {
    const storagePath = process.env.RECORDINGS_PATH || './storage/recordings';
    const candidateDir = path.join(storagePath, sessionId, candidateId);
    if (!fs.existsSync(candidateDir)) return;

    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { isMultiCandidate: true, candidateId: true },
    });
    if (!session) return;

    for (const streamType of ['screen', 'webcam'] as const) {
      const chunks = fs.readdirSync(candidateDir)
        .filter(f => f.startsWith(`${streamType}-chunk`))
        .sort((a, b) => {
          // Numeric sort on chunk index, not lexicographic (otherwise -10
          // comes before -2 and the merge order is wrong).
          const ai = parseInt(a.match(/-chunk-(\d+)/)?.[1] || '0', 10);
          const bi = parseInt(b.match(/-chunk-(\d+)/)?.[1] || '0', 10);
          return ai - bi;
        });
      if (chunks.length === 0) continue;

      const finalPath = path.join(candidateDir, `${streamType}.webm`);
      const writeStream = fs.createWriteStream(finalPath);
      for (const chunk of chunks) {
        const p = path.join(candidateDir, chunk);
        writeStream.write(fs.readFileSync(p));
        fs.unlinkSync(p);
      }
      await new Promise<void>(resolve => writeStream.end(resolve));

      const field = streamType === 'screen' ? 'screenRecordingPath' : 'webcamRecordingPath';
      // Always write to the per-candidate row.
      await this.prisma.sessionCandidate.upsert({
        where: { sessionId_candidateId: { sessionId, candidateId } },
        create: { sessionId, candidateId, [field]: finalPath } as any,
        update: { [field]: finalPath } as any,
      });
      // Single-candidate: also mirror onto the session row so the legacy
      // HR "Watch Recording" path still resolves without a per-candidate id.
      if (!session.isMultiCandidate && candidateId === session.candidateId) {
        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: {
            [field]: finalPath,
            recordingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          } as any,
        });
      } else {
        // Multi-candidate: still bump the session retention clock so the
        // 7-day purge cron knows when to clean up.
        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: { recordingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
      }
    }
  }

  // Finalize ALL candidates in a session. Iterates the SessionCandidate
  // rows + the primary candidate (for single-candidate compat). Safe to
  // call multiple times — each candidate's merge is idempotent once
  // their chunks are consumed.
  async finalizeRecording(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, sessionCandidates: { select: { candidateId: true } } },
    });
    if (!session) return;
    const ids = new Set<string>([session.candidateId]);
    session.sessionCandidates.forEach(sc => ids.add(sc.candidateId));
    for (const cid of ids) {
      await this.finalizeRecordingForCandidate(sessionId, cid);
    }
  }

  async getRecordingUrl(
    sessionId: string,
    requestingUser: any,
    candidateId?: string,
    streamType: 'screen' | 'webcam' = 'screen',
  ): Promise<{ url: string; expiresAt: string }> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        organizationId: true,
        recordingPurged: true,
        candidateId: true,
        isMultiCandidate: true,
        screenRecordingPath: true,
        webcamRecordingPath: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Tenant isolation
    if (!['SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR'].includes(requestingUser.role)) {
      if (session.organizationId !== requestingUser.organizationId) throw new ForbiddenException('Access denied');
    }

    if (session.recordingPurged) throw new ForbiddenException('Recording has been purged (7-day retention expired)');

    // Resolve the file path: prefer SessionCandidate row (multi-candidate
    // OR explicit candidateId), fall back to session-level for legacy
    // single-candidate sessions.
    const cId = candidateId || session.candidateId;
    let filePath: string | null | undefined = null;
    if (candidateId || session.isMultiCandidate) {
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        select: { screenRecordingPath: true, webcamRecordingPath: true },
      });
      filePath = streamType === 'webcam' ? sc?.webcamRecordingPath : sc?.screenRecordingPath;
    }
    if (!filePath) {
      filePath = streamType === 'webcam' ? session.webcamRecordingPath : session.screenRecordingPath;
    }
    if (!filePath) throw new NotFoundException('Recording not available');

    // Generate signed token (2-hour expiry)
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    this.signedUrls.set(token, { path: filePath, expires });

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

    // Walk session directories on disk — much cheaper than scanning the
    // DB for "anything with chunks". Per-candidate chunks live in
    // {sessionId}/{candidateId}/... so any chunk file at depth 2 is fair
    // game.
    const sessionDirs = fs.readdirSync(storagePath).filter(d => {
      try { return fs.statSync(path.join(storagePath, d)).isDirectory(); } catch { return false; }
    });

    let recovered = 0;
    for (const sessionId of sessionDirs) {
      const sessionDir = path.join(storagePath, sessionId);
      const candidateDirs = fs.readdirSync(sessionDir).filter(d => {
        try { return fs.statSync(path.join(sessionDir, d)).isDirectory(); } catch { return false; }
      });
      for (const candidateId of candidateDirs) {
        const candDir = path.join(sessionDir, candidateId);
        const chunks = fs.readdirSync(candDir).filter(f => f.includes('-chunk-'));
        if (chunks.length === 0) continue;
        const newest = chunks
          .map(f => fs.statSync(path.join(candDir, f)).mtimeMs)
          .reduce((a, b) => Math.max(a, b), 0);
        // Skip if a recorder might still be writing (newest chunk <5 min old).
        if (Date.now() - newest < 5 * 60 * 1000) continue;
        try {
          await this.finalizeRecordingForCandidate(sessionId, candidateId);
          recovered++;
        } catch (e) {
          console.warn(`Orphan finalize failed for ${sessionId}/${candidateId}:`, (e as any)?.message);
        }
      }
    }
    if (recovered > 0) console.log(`Orphan recording sweep merged ${recovered} candidate stream(s).`);
  }

  // Daily cron at 3 AM — purge expired recordings
  @Cron('0 3 * * *')
  async purgeExpiredRecordings() {
    // Multi-candidate sessions may have no screenRecordingPath at the
    // session level (it's on SessionCandidate), so include any session
    // with an expired retention clock regardless of which path is set.
    const expired = await this.prisma.examSession.findMany({
      where: {
        recordingPurged: false,
        recordingExpiresAt: { lt: new Date() },
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
        // Wipe the per-candidate paths too.
        await this.prisma.sessionCandidate.updateMany({
          where: { sessionId: session.id },
          data: { screenRecordingPath: null, webcamRecordingPath: null },
        });
        console.log(`Purged recording for session ${session.id}`);
      } catch (e) {
        console.error(`Failed to purge recording for session ${session.id}:`, (e as any).message);
      }
    }

    console.log(`Recording purge complete. Purged ${expired.length} sessions.`);
  }
}
