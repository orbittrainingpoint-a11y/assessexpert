import { Injectable, Logger } from '@nestjs/common';
import { MultipleFaceDetectionService } from '../mediapipe/multiple-face-detection.service';
import { PoseDetectionService } from '../mediapipe/pose-detection.service';
import { HandDetectionService } from '../mediapipe/hand-detection.service';
import { GazeTrackingService } from '../mediapipe/gaze-tracking.service';
import { AppGateway } from '../gateway/app.gateway';

interface MonitoringSession {
  sessionId: string;
  isActive: boolean;
  lastFrameTime: number;
  frameCount: number;
}

@Injectable()
export class RealTimeMonitoringService {
  private readonly logger = new Logger(RealTimeMonitoringService.name);
  private readonly activeSessions = new Map<string, MonitoringSession>();
  private readonly frameInterval = 3000; // Process every 3 seconds

  constructor(
    private multipleFaceService: MultipleFaceDetectionService,
    private poseService: PoseDetectionService,
    private handService: HandDetectionService,
    private gazeService: GazeTrackingService,
    private gateway: AppGateway,
  ) {}

  /**
   * Start monitoring a session
   */
  startMonitoring(sessionId: string) {
    if (this.activeSessions.has(sessionId)) {
      this.logger.warn(`Session ${sessionId} already being monitored`);
      return;
    }

    this.activeSessions.set(sessionId, {
      sessionId,
      isActive: true,
      lastFrameTime: 0,
      frameCount: 0,
    });

    this.logger.log(`Started monitoring session: ${sessionId}`);
  }

  /**
   * Stop monitoring a session
   */
  stopMonitoring(sessionId: string) {
    this.activeSessions.delete(sessionId);
    this.logger.log(`Stopped monitoring session: ${sessionId}`);
  }

  /**
   * Process a frame from candidate camera
   */
  async processFrame(sessionId: string, imageBase64: string): Promise<{
    processed: boolean;
    faceCount?: number;
    hasMultipleFaces?: boolean;
    alertGenerated?: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return { processed: false };
    }

    // Check if enough time has passed since last frame
    const now = Date.now();
    if (now - session.lastFrameTime < this.frameInterval) {
      return { processed: false };
    }

    try {
      // Update session
      session.lastFrameTime = now;
      session.frameCount++;

      // Check for multiple faces
      const result = await this.multipleFaceService.checkMultipleFaces(
        sessionId,
        imageBase64,
        (event, data) => this.gateway.emitToSession(sessionId, event, data)
      );

      // Check for absence (every 5th frame)
      if (session.frameCount % 5 === 0) {
        await this.multipleFaceService.checkAbsence(
          sessionId,
          imageBase64,
          (event, data) => this.gateway.emitToSession(sessionId, event, data)
        );
      }

      // Check for looking away (every 3rd frame)
      if (session.frameCount % 3 === 0) {
        await this.poseService.checkLookingAway(
          sessionId,
          imageBase64,
          (event, data) => this.gateway.emitToSession(sessionId, event, data)
        );
      }

      // Check for hand near face (every 4th frame)
      if (session.frameCount % 4 === 0) {
        await this.handService.checkHandNearFace(
          sessionId,
          imageBase64,
          (event, data) => this.gateway.emitToSession(sessionId, event, data)
        );
      }

      // Check for suspicious gaze (every 3rd frame)
      if (session.frameCount % 3 === 0) {
        await this.gazeService.checkSuspiciousGaze(
          sessionId,
          imageBase64,
          (event, data) => this.gateway.emitToSession(sessionId, event, data)
        );
      }

      return {
        processed: true,
        faceCount: result.faceCount,
        hasMultipleFaces: result.hasMultipleFaces,
        alertGenerated: result.shouldAlert,
      };
    } catch (error) {
      this.logger.error(`Frame processing error for session ${sessionId}:`, error.message);
      return { processed: false };
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(sessionId: string): MonitoringSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Cleanup inactive sessions
   */
  cleanup() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastFrameTime > timeout) {
        this.stopMonitoring(sessionId);
      }
    }
  }
}
