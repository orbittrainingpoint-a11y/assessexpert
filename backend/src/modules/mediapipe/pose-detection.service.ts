import { Injectable, Logger } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { ProctoringService } from '../proctoring/proctoring.service';

interface PoseData {
  landmarks: Array<{ x: number; y: number; z: number }>;
  headAngle: { pitch: number; yaw: number; roll: number };
  isLookingAway: boolean;
  isStanding: boolean;
  confidence: number;
}

interface LookingAwayAlert {
  sessionId: string;
  duration: number;
  headAngle: { pitch: number; yaw: number; roll: number };
  timestamp: Date;
}

@Injectable()
export class PoseDetectionService {
  private readonly logger = new Logger(PoseDetectionService.name);
  private readonly lookingAwayThreshold = 45; // degrees
  private readonly lookingAwayDuration = 3000; // 3 seconds
  private readonly lookingAwayBuffer = new Map<string, number[]>(); // sessionId -> timestamps
  private readonly alertCooldown = new Map<string, number>();
  private readonly cooldownPeriod = 10000; // 10 seconds

  constructor(
    private mediaPipeService: MediaPipeService,
    private proctoringService: ProctoringService,
  ) {}

  /**
   * Detect pose and analyze body posture
   */
  async detectPose(imageBase64: string): Promise<PoseData | null> {
    try {
      // Note: Pose detection implementation depends on MediaPipe pose model
      // For now, return mock data structure
      // TODO: Implement actual pose detection when models are loaded
      
      return {
        landmarks: [],
        headAngle: { pitch: 0, yaw: 0, roll: 0 },
        isLookingAway: false,
        isStanding: false,
        confidence: 0.95,
      };
    } catch (error) {
      this.logger.error('Pose detection error:', error.message);
      return null;
    }
  }

  /**
   * Check if candidate is looking away from screen
   */
  async checkLookingAway(
    sessionId: string,
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ): Promise<{
    isLookingAway: boolean;
    headAngle: { pitch: number; yaw: number; roll: number };
    shouldAlert: boolean;
  }> {
    try {
      // Extract face landmarks to estimate head pose
      const landmarks = await this.mediaPipeService.extractFaceLandmarks(imageBase64);
      
      if (!landmarks) {
        return {
          isLookingAway: false,
          headAngle: { pitch: 0, yaw: 0, roll: 0 },
          shouldAlert: false,
        };
      }

      // Calculate head angles from landmarks
      const headAngle = this.calculateHeadPose(landmarks.landmarks);
      const isLookingAway = this.isHeadTurnedAway(headAngle);

      // Track looking away over time
      if (isLookingAway) {
        this.trackLookingAway(sessionId);
      } else {
        this.clearLookingAwayBuffer(sessionId);
      }

      // Check if alert should be triggered
      const shouldAlert = this.shouldTriggerLookingAwayAlert(sessionId, isLookingAway);

      if (shouldAlert) {
        await this.generateLookingAwayAlert(sessionId, headAngle, emitAlert);
      }

      return {
        isLookingAway,
        headAngle,
        shouldAlert,
      };
    } catch (error) {
      this.logger.error('Looking away check error:', error.message);
      return {
        isLookingAway: false,
        headAngle: { pitch: 0, yaw: 0, roll: 0 },
        shouldAlert: false,
      };
    }
  }

  /**
   * Calculate head pose angles from face landmarks
   */
  private calculateHeadPose(landmarks: Array<{ x: number; y: number; z: number }>): {
    pitch: number;
    yaw: number;
    roll: number;
  } {
    if (landmarks.length < 468) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Key landmark indices for head pose estimation
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];

    // Calculate yaw (left-right rotation)
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const yaw = (noseTip.x - eyeMidX) * 90; // Approximate angle

    // Calculate pitch (up-down rotation)
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const mouthMidY = (leftMouth.y + rightMouth.y) / 2;
    const pitch = (mouthMidY - eyeMidY) * 90; // Approximate angle

    // Calculate roll (tilt)
    const eyeDeltaY = rightEye.y - leftEye.y;
    const eyeDeltaX = rightEye.x - leftEye.x;
    const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

    return {
      pitch: Math.round(pitch),
      yaw: Math.round(yaw),
      roll: Math.round(roll),
    };
  }

  /**
   * Check if head is turned away beyond threshold
   */
  private isHeadTurnedAway(headAngle: { pitch: number; yaw: number; roll: number }): boolean {
    return (
      Math.abs(headAngle.yaw) > this.lookingAwayThreshold ||
      Math.abs(headAngle.pitch) > this.lookingAwayThreshold
    );
  }

  /**
   * Track looking away over time
   */
  private trackLookingAway(sessionId: string) {
    const now = Date.now();
    const buffer = this.lookingAwayBuffer.get(sessionId) || [];
    
    buffer.push(now);
    
    // Remove old timestamps
    const filtered = buffer.filter(ts => now - ts < this.lookingAwayDuration);
    
    this.lookingAwayBuffer.set(sessionId, filtered);
  }

  /**
   * Clear looking away buffer
   */
  private clearLookingAwayBuffer(sessionId: string) {
    this.lookingAwayBuffer.delete(sessionId);
  }

  /**
   * Check if looking away alert should be triggered
   */
  private shouldTriggerLookingAwayAlert(sessionId: string, isLookingAway: boolean): boolean {
    if (!isLookingAway) return false;

    // Check duration
    const buffer = this.lookingAwayBuffer.get(sessionId) || [];
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
   * Generate looking away alert
   */
  private async generateLookingAwayAlert(
    sessionId: string,
    headAngle: { pitch: number; yaw: number; roll: number },
    emitAlert: (event: string, data: any) => void
  ) {
    try {
      // Log event to database
      await this.proctoringService.logEvent(sessionId, {
        eventType: 'GAZE_OFFSCREEN',
        severity: 'WARNING',
        source: 'AI',
        payload: {
          headAngle,
          threshold: this.lookingAwayThreshold,
          detectionMethod: 'MEDIAPIPE',
        },
      });

      // Emit real-time alert
      emitAlert('ai.looking_away', {
        sessionId,
        headAngle,
        timestamp: new Date().toISOString(),
        message: 'Candidate looking away from screen',
        severity: 'WARNING',
      });

      // Update cooldown
      this.alertCooldown.set(sessionId, Date.now());

      this.logger.warn(`Looking away alert: Session ${sessionId}, Angle: yaw=${headAngle.yaw}°, pitch=${headAngle.pitch}°`);
    } catch (error) {
      this.logger.error('Failed to generate looking away alert:', error.message);
    }
  }

  /**
   * Detect if candidate is standing (posture change)
   */
  async detectStanding(imageBase64: string): Promise<boolean> {
    // TODO: Implement using pose landmarks
    // Check if shoulder-to-hip ratio indicates standing position
    return false;
  }

  /**
   * Clean up old buffers
   */
  cleanup() {
    const now = Date.now();
    for (const [sessionId, timestamps] of this.lookingAwayBuffer.entries()) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 60000) {
        this.lookingAwayBuffer.delete(sessionId);
        this.alertCooldown.delete(sessionId);
      }
    }
  }
}
