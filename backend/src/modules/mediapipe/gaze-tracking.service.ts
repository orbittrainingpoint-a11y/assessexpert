import { Injectable, Logger } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { ProctoringService } from '../proctoring/proctoring.service';

interface GazeData {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  gazeDirection: { x: number; y: number };
  isLookingAtScreen: boolean;
  isLookingAway: boolean;
  confidence: number;
}

interface EyeMovementPattern {
  frequency: number; // movements per minute
  averageDistance: number;
  suspiciousPattern: boolean;
}

@Injectable()
export class GazeTrackingService {
  private readonly logger = new Logger(GazeTrackingService.name);
  private readonly gazeThreshold = 0.3; // Distance from center
  private readonly suspiciousDuration = 4000; // 4 seconds
  private readonly gazeBuffer = new Map<string, Array<{ timestamp: number; direction: { x: number; y: number } }>>();
  private readonly alertCooldown = new Map<string, number>();
  private readonly cooldownPeriod = 12000; // 12 seconds

  constructor(
    private mediaPipeService: MediaPipeService,
    private proctoringService: ProctoringService,
  ) {}

  /**
   * Track gaze direction from face landmarks
   */
  async trackGaze(imageBase64: string): Promise<GazeData | null> {
    try {
      const landmarks = await this.mediaPipeService.extractFaceLandmarks(imageBase64);
      
      if (!landmarks) {
        return null;
      }

      // Extract eye landmarks
      const leftEye = this.getEyeCenter(landmarks.landmarks, 'left');
      const rightEye = this.getEyeCenter(landmarks.landmarks, 'right');

      // Calculate gaze direction
      const gazeDirection = this.calculateGazeDirection(landmarks.landmarks);

      // Check if looking at screen
      const isLookingAtScreen = this.isGazeOnScreen(gazeDirection);
      const isLookingAway = !isLookingAtScreen;

      return {
        leftEye,
        rightEye,
        gazeDirection,
        isLookingAtScreen,
        isLookingAway,
        confidence: 0.85,
      };
    } catch (error) {
      this.logger.error('Gaze tracking error:', error.message);
      return null;
    }
  }

  /**
   * Check for suspicious gaze patterns
   */
  async checkSuspiciousGaze(
    sessionId: string,
    imageBase64: string,
    emitAlert: (event: string, data: any) => void
  ): Promise<{
    isLookingAway: boolean;
    gazeDirection: { x: number; y: number };
    shouldAlert: boolean;
  }> {
    try {
      const gazeData = await this.trackGaze(imageBase64);
      
      if (!gazeData) {
        return {
          isLookingAway: false,
          gazeDirection: { x: 0, y: 0 },
          shouldAlert: false,
        };
      }

      const isLookingAway = gazeData.isLookingAway;

      // Track gaze over time
      if (isLookingAway) {
        this.trackGazePattern(sessionId, gazeData.gazeDirection);
      } else {
        this.clearGazeBuffer(sessionId);
      }

      // Check if alert should be triggered
      const shouldAlert = this.shouldTriggerGazeAlert(sessionId, isLookingAway);

      if (shouldAlert) {
        await this.generateGazeAlert(sessionId, gazeData, emitAlert);
      }

      return {
        isLookingAway,
        gazeDirection: gazeData.gazeDirection,
        shouldAlert,
      };
    } catch (error) {
      this.logger.error('Suspicious gaze check error:', error.message);
      return {
        isLookingAway: false,
        gazeDirection: { x: 0, y: 0 },
        shouldAlert: false,
      };
    }
  }

  /**
   * Get eye center from landmarks
   */
  private getEyeCenter(
    landmarks: Array<{ x: number; y: number; z: number }>,
    eye: 'left' | 'right'
  ): { x: number; y: number } {
    // Left eye landmarks: 33, 133, 160, 159, 158, 157
    // Right eye landmarks: 263, 362, 387, 386, 385, 384
    
    const eyeLandmarks = eye === 'left' 
      ? [33, 133, 160, 159, 158, 157]
      : [263, 362, 387, 386, 385, 384];

    let sumX = 0;
    let sumY = 0;

    for (const idx of eyeLandmarks) {
      if (landmarks[idx]) {
        sumX += landmarks[idx].x;
        sumY += landmarks[idx].y;
      }
    }

    return {
      x: sumX / eyeLandmarks.length,
      y: sumY / eyeLandmarks.length,
    };
  }

  /**
   * Calculate gaze direction vector
   */
  private calculateGazeDirection(
    landmarks: Array<{ x: number; y: number; z: number }>
  ): { x: number; y: number } {
    // Get eye centers
    const leftEye = this.getEyeCenter(landmarks, 'left');
    const rightEye = this.getEyeCenter(landmarks, 'right');

    // Get nose tip (reference point)
    const noseTip = landmarks[1];

    // Calculate gaze direction relative to nose
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    return {
      x: eyeCenter.x - noseTip.x,
      y: eyeCenter.y - noseTip.y,
    };
  }

  /**
   * Check if gaze is on screen (within threshold)
   */
  private isGazeOnScreen(gazeDirection: { x: number; y: number }): boolean {
    const distance = Math.sqrt(
      gazeDirection.x * gazeDirection.x +
      gazeDirection.y * gazeDirection.y
    );

    return distance < this.gazeThreshold;
  }

  /**
   * Track gaze pattern over time
   */
  private trackGazePattern(sessionId: string, gazeDirection: { x: number; y: number }) {
    const now = Date.now();
    const buffer = this.gazeBuffer.get(sessionId) || [];
    
    buffer.push({
      timestamp: now,
      direction: gazeDirection,
    });
    
    // Remove old entries
    const filtered = buffer.filter(entry => now - entry.timestamp < this.suspiciousDuration);
    
    this.gazeBuffer.set(sessionId, filtered);
  }

  /**
   * Clear gaze buffer
   */
  private clearGazeBuffer(sessionId: string) {
    this.gazeBuffer.delete(sessionId);
  }

  /**
   * Check if gaze alert should be triggered
   */
  private shouldTriggerGazeAlert(sessionId: string, isLookingAway: boolean): boolean {
    if (!isLookingAway) return false;

    // Check duration
    const buffer = this.gazeBuffer.get(sessionId) || [];
    if (buffer.length < 4) return false; // Need at least 4 detections

    // Check cooldown
    const lastAlert = this.alertCooldown.get(sessionId) || 0;
    const now = Date.now();
    
    if (now - lastAlert < this.cooldownPeriod) {
      return false;
    }

    return true;
  }

  /**
   * Generate gaze alert
   */
  private async generateGazeAlert(
    sessionId: string,
    gazeData: GazeData,
    emitAlert: (event: string, data: any) => void
  ) {
    try {
      // Log event to database
      await this.proctoringService.logEvent(sessionId, {
        eventType: 'GAZE_OFFSCREEN',
        severity: 'WARNING',
        source: 'AI',
        payload: {
          gazeDirection: gazeData.gazeDirection,
          threshold: this.gazeThreshold,
          detectionMethod: 'MEDIAPIPE',
          description: 'Candidate looking away from screen - possible secondary monitor',
        },
      });

      // Emit real-time alert
      emitAlert('ai.gaze_offscreen', {
        sessionId,
        gazeDirection: gazeData.gazeDirection,
        timestamp: new Date().toISOString(),
        message: 'Candidate looking away from screen',
        severity: 'WARNING',
      });

      // Update cooldown
      this.alertCooldown.set(sessionId, Date.now());

      this.logger.warn(`Gaze offscreen alert: Session ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to generate gaze alert:', error.message);
    }
  }

  /**
   * Analyze eye movement patterns
   */
  analyzeEyeMovementPattern(sessionId: string): EyeMovementPattern {
    const buffer = this.gazeBuffer.get(sessionId) || [];
    
    if (buffer.length < 2) {
      return {
        frequency: 0,
        averageDistance: 0,
        suspiciousPattern: false,
      };
    }

    // Calculate movement frequency
    const timeSpan = (buffer[buffer.length - 1].timestamp - buffer[0].timestamp) / 1000; // seconds
    const frequency = (buffer.length / timeSpan) * 60; // movements per minute

    // Calculate average distance between consecutive gazes
    let totalDistance = 0;
    for (let i = 1; i < buffer.length; i++) {
      const prev = buffer[i - 1].direction;
      const curr = buffer[i].direction;
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) +
        Math.pow(curr.y - prev.y, 2)
      );
      totalDistance += distance;
    }
    const averageDistance = totalDistance / (buffer.length - 1);

    // Detect suspicious pattern (rapid, large movements)
    const suspiciousPattern = frequency > 30 && averageDistance > 0.2;

    return {
      frequency,
      averageDistance,
      suspiciousPattern,
    };
  }

  /**
   * Clean up old buffers
   */
  cleanup() {
    const now = Date.now();
    for (const [sessionId, buffer] of this.gazeBuffer.entries()) {
      if (buffer.length === 0 || now - buffer[buffer.length - 1].timestamp > 60000) {
        this.gazeBuffer.delete(sessionId);
        this.alertCooldown.delete(sessionId);
      }
    }
  }
}
