import { Injectable, Logger } from '@nestjs/common';
import { ImageProcessor } from '../../utils/image-processor';
import * as sharp from 'sharp';

export interface DocumentDetectionResult {
  documentDetected: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  quality: {
    inFocus: boolean;
    hasGlare: boolean;
    wellLit: boolean;
    issues: string[];
  };
  guidance?: string[];
}

interface FaceExtractionResult {
  success: boolean;
  faceImage?: string; // base64
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

@Injectable()
export class IDDocumentDetectionService {
  private readonly logger = new Logger(IDDocumentDetectionService.name);

  /**
   * Detect ID document in image
   */
  async detectDocument(imageBase64: string): Promise<DocumentDetectionResult> {
    try {
      // Validate image quality
      const quality = await ImageProcessor.validateImageQuality(imageBase64);

      // Check for rectangular shapes (ID cards are rectangular)
      const hasRectangle = await this.detectRectangularObject(imageBase64);

      // Check for glare (common issue with ID cards)
      const hasGlare = await this.detectGlare(imageBase64);

      // Generate guidance
      const guidance: string[] = [];
      const issues: string[] = [];

      if (!hasRectangle) {
        guidance.push('Hold ID card flat and centered in frame');
        issues.push('No document detected');
      }

      if (hasGlare) {
        guidance.push('Reduce glare - adjust lighting or angle');
        issues.push('Glare detected');
      }

      if (quality.brightness < 80) {
        guidance.push('Increase lighting - image too dark');
        issues.push('Poor lighting');
      }

      if (quality.sharpness < 25) {
        guidance.push('Hold camera steady - image is blurry');
        issues.push('Image blurry');
      }

      return {
        documentDetected: hasRectangle && !hasGlare,
        confidence: hasRectangle ? 0.85 : 0.3,
        quality: {
          inFocus: quality.sharpness >= 25,
          hasGlare,
          wellLit: quality.brightness >= 80 && quality.brightness <= 200,
          issues,
        },
        guidance: guidance.length > 0 ? guidance : undefined,
      };
    } catch (error) {
      this.logger.error('Document detection error:', error.message);
      return {
        documentDetected: false,
        confidence: 0,
        quality: {
          inFocus: false,
          hasGlare: false,
          wellLit: false,
          issues: ['Detection failed'],
        },
      };
    }
  }

  /**
   * Extract face from ID document
   */
  async extractFaceFromID(
    imageBase64: string,
    documentBoundingBox?: { x: number; y: number; width: number; height: number }
  ): Promise<FaceExtractionResult> {
    try {
      // If document bounding box provided, crop to document first
      let processImage = imageBase64;
      
      if (documentBoundingBox) {
        processImage = await ImageProcessor.cropImage(
          imageBase64,
          documentBoundingBox.x,
          documentBoundingBox.y,
          documentBoundingBox.width,
          documentBoundingBox.height
        );
      }

      // Enhance image for better face detection
      const enhanced = await ImageProcessor.enhanceImage(processImage);

      // TODO: Use MediaPipe to detect face in ID
      // For now, return mock result
      
      return {
        success: false,
        confidence: 0,
      };
    } catch (error) {
      this.logger.error('Face extraction error:', error.message);
      return {
        success: false,
        confidence: 0,
      };
    }
  }

  /**
   * Validate ID document quality
   */
  async validateIDQuality(imageBase64: string): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const detection = await this.detectDocument(imageBase64);
    const quality = await ImageProcessor.validateImageQuality(imageBase64);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check document detection
    if (!detection.documentDetected) {
      issues.push('ID document not clearly visible');
      recommendations.push('Center ID card in frame');
      score -= 30;
    }

    // Check glare
    if (detection.quality.hasGlare) {
      issues.push('Glare on document');
      recommendations.push('Adjust lighting or angle to reduce glare');
      score -= 25;
    }

    // Check focus
    if (!detection.quality.inFocus) {
      issues.push('Image out of focus');
      recommendations.push('Hold camera steady and ensure ID is in focus');
      score -= 20;
    }

    // Check lighting
    if (!detection.quality.wellLit) {
      issues.push('Poor lighting');
      recommendations.push('Improve lighting conditions');
      score -= 15;
    }

    // Check resolution
    const metadata = await ImageProcessor.getMetadata(imageBase64);
    if (metadata.width < 640 || metadata.height < 480) {
      issues.push('Resolution too low');
      recommendations.push('Use higher resolution camera');
      score -= 10;
    }

    return {
      isValid: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
    };
  }

  /**
   * Detect rectangular object (ID card shape)
   */
  private async detectRectangularObject(imageBase64: string): Promise<boolean> {
    try {
      // Simple edge detection approach
      // TODO: Implement proper rectangle detection using OpenCV or similar
      
      const buffer = Buffer.from(
        imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );

      // Use sharp to detect edges
      const edges = await sharp(buffer)
        .greyscale()
        .normalise()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Edge detection kernel
        })
        .toBuffer();

      // Analyze edge density
      // High edge density in rectangular pattern suggests ID card
      // This is a simplified approach
      
      return true; // Mock result for now
    } catch (error) {
      this.logger.error('Rectangle detection error:', error.message);
      return false;
    }
  }

  /**
   * Detect glare in image
   */
  private async detectGlare(imageBase64: string): Promise<boolean> {
    try {
      const buffer = Buffer.from(
        imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );

      // Get image statistics
      const stats = await sharp(buffer).stats();

      // Check for very bright spots (glare)
      // If max brightness is very high and there's high variance, likely glare
      const maxBrightness = Math.max(
        ...stats.channels.map(ch => ch.max)
      );

      const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;

      // Glare detection: very bright spots with high contrast
      const hasGlare = maxBrightness > 240 && (maxBrightness - avgBrightness) > 100;

      return hasGlare;
    } catch (error) {
      this.logger.error('Glare detection error:', error.message);
      return false;
    }
  }

  /**
   * Guide candidate for better ID capture
   */
  getRealTimeGuidance(detection: DocumentDetectionResult): string[] {
    const guidance: string[] = [];

    if (!detection.documentDetected) {
      guidance.push('📄 Position ID card in center of frame');
    }

    if (detection.quality.hasGlare) {
      guidance.push('💡 Reduce glare - adjust angle or lighting');
    }

    if (!detection.quality.inFocus) {
      guidance.push('🎯 Hold camera steady - keep ID in focus');
    }

    if (!detection.quality.wellLit) {
      guidance.push('🔦 Improve lighting - image too dark');
    }

    if (guidance.length === 0) {
      guidance.push('✅ Good! Hold steady and capture');
    }

    return guidance;
  }
}
