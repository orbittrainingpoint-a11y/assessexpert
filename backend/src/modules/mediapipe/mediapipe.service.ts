import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { FilesetResolver, FaceLandmarker, FaceDetector, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

export interface DetectedFace {
  boundingBox: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface FaceLandmarks {
  landmarks: Array<{ x: number; y: number; z: number }>;
  embedding: number[];
}

export interface FaceComparisonResult {
  similarity: number;
  outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
  confidence: number;
}

@Injectable()
export class MediaPipeService implements OnModuleInit {
  private readonly logger = new Logger(MediaPipeService.name);
  private faceDetector: FaceDetector | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private modelsLoaded = false;
  private readonly modelPath = path.join(process.cwd(), 'ml-models');

  async onModuleInit() {
    this.logger.log('Initializing MediaPipe Service...');
    await this.loadModels();
  }

  private async loadModels() {
    try {
      // Check if models exist
      const requiredModels = [
        'face_detection_short_range.tflite',
        'face_landmarker.task',
        'pose_landmarker_lite.task',
        'hand_landmarker.task',
      ];

      const missingModels = requiredModels.filter(
        model => !fs.existsSync(path.join(this.modelPath, model))
      );

      if (missingModels.length > 0) {
        this.logger.warn(
          `Missing MediaPipe models: ${missingModels.join(', ')}. Run download-models script.`
        );
        this.logger.warn('MediaPipe will operate in fallback mode.');
        return;
      }

      // Load Vision tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Load Face Detector
      this.faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: path.join(this.modelPath, 'face_detection_short_range.tflite'),
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });

      // Load Face Landmarker
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: path.join(this.modelPath, 'face_landmarker.task'),
        },
        runningMode: 'IMAGE',
        numFaces: 5,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Load Pose Landmarker
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: path.join(this.modelPath, 'pose_landmarker_lite.task'),
        },
        runningMode: 'IMAGE',
        numPoses: 1,
      });

      // Load Hand Landmarker
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: path.join(this.modelPath, 'hand_landmarker.task'),
        },
        runningMode: 'IMAGE',
        numHands: 2,
      });

      this.modelsLoaded = true;
      this.logger.log('MediaPipe models loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load MediaPipe models:', error.message);
      this.logger.warn('MediaPipe will operate in fallback mode');
    }
  }

  /**
   * Detect faces in an image
   */
  async detectFaces(imageBase64: string): Promise<DetectedFace[]> {
    if (!this.modelsLoaded || !this.faceDetector) {
      // Hard refuse instead of returning a fake hit. False positives here
      // cascade into a silent FR auto-pass which is the opposite of what
      // a proctoring system should do.
      this.logger.error('Face detector not loaded — refusing to fake detection');
      return [];
    }

    try {
      const imageBuffer = this.base64ToBuffer(imageBase64);
      
      // Convert to raw pixel data using sharp
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Create ImageData-like object for MediaPipe
      const imageData = {
        data: new Uint8ClampedArray(data),
        width: info.width,
        height: info.height,
      };

      const detections = this.faceDetector.detect(imageData as any);

      return detections.detections.map(detection => ({
        boundingBox: {
          originX: detection.boundingBox.originX,
          originY: detection.boundingBox.originY,
          width: detection.boundingBox.width,
          height: detection.boundingBox.height,
        },
        confidence: detection.categories[0]?.score || 0,
      }));
    } catch (error) {
      this.logger.error('Face detection error:', error.message);
      return [];
    }
  }

  /**
   * Extract face landmarks and generate embedding
   */
  async extractFaceLandmarks(imageBase64: string): Promise<FaceLandmarks | null> {
    if (!this.modelsLoaded || !this.faceLandmarker) {
      // Returning null lets callers branch on "FR unavailable" and
      // explicitly reject. The old mock-embedding fallback was a silent
      // false positive in the FR pipeline.
      this.logger.error('Face landmarker not loaded — refusing to fake landmarks');
      return null;
    }

    try {
      const imageBuffer = this.base64ToBuffer(imageBase64);
      
      // Convert to raw pixel data using sharp
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Create ImageData-like object for MediaPipe
      const imageData = {
        data: new Uint8ClampedArray(data),
        width: info.width,
        height: info.height,
      };

      const result = this.faceLandmarker.detect(imageData as any);

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        return null;
      }

      const landmarks = result.faceLandmarks[0];
      const embedding = this.generateEmbedding(landmarks);

      return {
        landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
        embedding,
      };
    } catch (error) {
      this.logger.error('Landmark extraction error:', error.message);
      return null;
    }
  }

  /**
   * Compare two face embeddings
   */
  compareFaceEmbeddings(
    embedding1: number[],
    embedding2: number[]
  ): FaceComparisonResult {
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    
    let outcome: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
    if (similarity >= 0.6) {
      outcome = 'VERIFIED';
    } else if (similarity >= 0.4) {
      outcome = 'PENDING_REVIEW';
    } else {
      outcome = 'REJECTED';
    }

    return {
      similarity: similarity * 100, // Convert to percentage
      outcome,
      confidence: similarity,
    };
  }

  /**
   * Count faces in image
   */
  async countFaces(imageBase64: string): Promise<number> {
    const faces = await this.detectFaces(imageBase64);
    return faces.length;
  }

  /**
   * Check if multiple faces detected
   */
  async hasMultipleFaces(imageBase64: string): Promise<boolean> {
    const count = await this.countFaces(imageBase64);
    return count > 1;
  }

  // ========== UTILITY METHODS ==========

  private base64ToBuffer(base64: string): Buffer {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  private generateEmbedding(landmarks: any[]): number[] {
    // Generate a 128-dimensional embedding from landmarks
    // This is a simplified version - in production, use a proper face recognition model
    const embedding: number[] = [];
    
    // Sample key facial points for embedding
    const keyPoints = [
      0, 1, 4, 5, 6, 10, 33, 61, 93, 133, 152, 159, 263, 291, 323, 362,
      // Add more key landmark indices
    ];

    for (let i = 0; i < 128; i++) {
      const idx = keyPoints[i % keyPoints.length];
      const lm = landmarks[idx] || { x: 0, y: 0, z: 0 };
      embedding.push(lm.x + lm.y + lm.z);
    }

    return this.normalizeEmbedding(embedding);
  }

  private normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return embedding.map(val => val / (magnitude || 1));
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) return 0;

    return dotProduct / (mag1 * mag2);
  }

  // (Fallback face/landmark mocks removed — silent false positives in
  // facial recognition are worse than an explicit "FR unavailable" error.)

  /**
   * Health check
   */
  isReady(): boolean {
    return this.modelsLoaded;
  }

  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      faceDetector: !!this.faceDetector,
      faceLandmarker: !!this.faceLandmarker,
      poseLandmarker: !!this.poseLandmarker,
      handLandmarker: !!this.handLandmarker,
    };
  }
}
