import { Injectable, Logger } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { ProctoringService } from '../proctoring/proctoring.service';

interface HandData {
  handCount: number;
  hands: Array<{
    landmarks: Array<{ x: number; y: number; z: number }>;
    handedness: 'Left' | 'Right';
    confidence: number;
  }>;
  nearFace: boolean;
  suspiciousGesture: boolean;
}

@Injectable()
export class HandDetectionService {
  private readonly logger = new Logger(HandDetectionService.name);
  private readonly handNearFaceThreshold = 0.3; // Distance threshold
  private readonly suspiciousDuration = 5000; // 5 seconds
  private readonly suspiciousBuffer = new Map<string, number[]>();
  private readonly alertCooldown = new Map<string, number>();
  private readonly cooldownPeriod = 15000; // 15 seconds

  constructor(
    private mediaPipeService: MediaPipeService,
    private proctoringService: ProctoringService,
  ) {}

  /**
   * Detect hands in frame
   */
  async detectHands(imageBase64: string): Promise<HandData> {
    try {
      // TODO: Implement actual hand detection when MediaPipe hand model is loaded
      // For now, return mock structure
      
      return {
        handCount: 0,
        hands: [],
        nearFace: false,
        suspiciousGesture: false,
      };
    } catch (error) {
      this.logger.error('Hand detection error:', error.message);
      return {
        handCount: 0,
        hands: [],
        nearFace: false,
        suspiciousGesture: false,
      };
    }
  }

  /**
   * Check for hands near face (potential phone usage)
   */
  async checkHandNearFace(
    sessionId: string,
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ): Promise<{
    handNearFace: boolean;
    handCount: number;
    shouldAlert: boolean;
  }> {
    try {
      const handData = await this.detectHands(imageBase64);
      const handNearFace = handData.nearFace;

      // Track suspicious behavior over time
      if (handNearFace) {
        this.trackSuspiciousBehavior(sessionId);
      } else {
        this.clearSuspiciousBuffer(sessionId);
      }

      // Check if alert should be triggered
      const shouldAlert = this.shouldTriggerAlert(sessionId, handNearFace);

      if (shouldAlert) {
        await this.generateHandNearFaceAlert(sessionId, handData, emitAlert);
      }

      return {
        handNearFace,
        handCount: handData.handCount,
        shouldAlert,
      };
    } catch (error) {
      this.logger.error('Hand near face check error:', error.message);
      return {
        handNearFace: false,
        handCount: 0,
        shouldAlert: false,
      };
    }
  }

  /**
   * Detect phone-holding gesture
   */
  private isPhoneHoldingGesture(landmarks: Array<{ x: number; y: number; z: number }>): boolean {
    // Check if hand is in typical phone-holding position
    // Thumb and fingers forming a grip pattern
    
    if (landmarks.length < 21) return false;

    const thumb = landmarks[4];
    const indexFinger = landmarks[8];
    const pinky = landmarks[20];

    // Check if fingers are close together (gripping)
    const thumbToIndex = Math.sqrt(
      Math.pow(thumb.x - indexFinger.x, 2) +
      Math.pow(thumb.y - indexFinger.y, 2)
    );

    const indexToPinky = Math.sqrt(
      Math.pow(indexFinger.x - pinky.x, 2) +
      Math.pow(indexFinger.y - pinky.y, 2)
    );

    // Phone grip: thumb opposite to fingers, fingers close together
    return thumbToIndex > 0.1 && indexToPinky < 0.15;
  }

  /**
   * Check if hand is near face region
   */
  private isHandNearFace(
    handLandmarks: Array<{ x: number; y: number; z: number }>,
    faceLandmarks: Array<{ x: number; y: number; z: number }>
  ): boolean {
    if (handLandmarks.length === 0 || faceLandmarks.length === 0) {
      return false;
    }

    // Get hand center (wrist)
    const handCenter = handLandmarks[0];

    // Get face center (nose tip)
    const faceCenter = faceLandmarks[1];

    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(handCenter.x - faceCenter.x, 2) +
      Math.pow(handCenter.y - faceCenter.y, 2)
    );

    return distance < this.handNearFaceThreshold;
  }

  /**
   * Track suspicious behavior over time
   */
  private trackSuspiciousBehavior(sessionId: string) {
    const now = Date.now();
    const buffer = this.suspiciousBuffer.get(sessionId) || [];
    
    buffer.push(now);
    
    // Remove old timestamps
    const filtered = buffer.filter(ts => now - ts < this.suspiciousDuration);
    
    this.suspiciousBuffer.set(sessionId, filtered);
  }

  /**
   * Clear suspicious behavior buffer
   */
  private clearSuspiciousBuffer(sessionId: string) {
    this.suspiciousBuffer.delete(sessionId);
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(sessionId: string, handNearFace: boolean): boolean {
    if (!handNearFace) return false;

    // Check duration
    const buffer = this.suspiciousBuffer.get(sessionId) || [];
    if (buffer.length < 5) return false; // Need at least 5 detections (5 seconds)

    // Check cooldown
    const lastAlert = this.alertCooldown.get(sessionId) || 0;
    const now = Date.now();
    
    if (now - lastAlert < this.cooldownPeriod) {
      return false;
    }

    return true;
  }

  /**
   * Generate hand near face alert
   */
  private async generateHandNearFaceAlert(
    sessionId: string,
    handData: HandData,
    emitAlert: (event: string, data: any) => void
  ) {
    try {
      // Log event to database
      await this.proctoringService.logEvent(sessionId, {
        eventType: 'AUDIO_ANOMALY', // Using existing event type
        severity: 'WARNING',
        source: 'AI',
        payload: {
          handCount: handData.handCount,
          nearFace: handData.nearFace,
          suspiciousGesture: handData.suspiciousGesture,
          detectionMethod: 'MEDIAPIPE',
          description: 'Hand detected near face - possible phone usage',
        },
      });

      // Emit real-time alert
      emitAlert('ai.hand_near_face', {
        sessionId,
        handCount: handData.handCount,
        timestamp: new Date().toISOString(),
        message: 'Hand detected near face - possible phone usage',
        severity: 'WARNING',
      });

      // Update cooldown
      this.alertCooldown.set(sessionId, Date.now());

      this.logger.warn(`Hand near face alert: Session ${sessionId}, Hands: ${handData.handCount}`);
    } catch (error) {
      this.logger.error('Failed to generate hand near face alert:', error.message);
    }
  }

  /**
   * Detect writing/typing motion
   */
  async detectWritingMotion(imageBase64: string): Promise<boolean> {
    // TODO: Implement motion detection
    // Track hand movement patterns over multiple frames
    return false;
  }

  /**
   * Clean up old buffers
   */
  cleanup() {
    const now = Date.now();
    for (const [sessionId, timestamps] of this.suspiciousBuffer.entries()) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 60000) {
        this.suspiciousBuffer.delete(sessionId);
        this.alertCooldown.delete(sessionId);
      }
    }
  }
}
