import { createCanvas, loadImage, Image } from 'canvas';
import * as sharp from 'sharp';

export class ImageProcessor {
  /**
   * Convert base64 to Buffer
   */
  static base64ToBuffer(base64: string): Buffer {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Convert Buffer to base64
   */
  static bufferToBase64(buffer: Buffer, mimeType = 'image/jpeg'): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Resize image to target dimensions
   */
  static async resizeImage(
    imageBase64: string,
    width: number,
    height: number
  ): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const resized = await sharp(buffer)
        .resize(width, height, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      return this.bufferToBase64(resized);
    } catch (error) {
      throw new Error(`Image resize failed: ${error.message}`);
    }
  }

  /**
   * Validate image quality (brightness, sharpness)
   */
  static async validateImageQuality(imageBase64: string): Promise<{
    isValid: boolean;
    brightness: number;
    sharpness: number;
    issues: string[];
  }> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();
      const stats = await sharp(buffer).stats();

      const issues: string[] = [];
      
      // Calculate average brightness (0-255)
      const brightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
      
      // Check brightness
      if (brightness < 50) {
        issues.push('Image too dark');
      } else if (brightness > 200) {
        issues.push('Image too bright');
      }

      // Estimate sharpness (simplified - check standard deviation)
      const sharpness = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
      
      if (sharpness < 20) {
        issues.push('Image too blurry');
      }

      // Check resolution
      if (metadata.width < 320 || metadata.height < 240) {
        issues.push('Resolution too low');
      }

      return {
        isValid: issues.length === 0,
        brightness,
        sharpness,
        issues,
      };
    } catch (error) {
      return {
        isValid: false,
        brightness: 0,
        sharpness: 0,
        issues: ['Failed to analyze image quality'],
      };
    }
  }

  /**
   * Compress image for storage
   */
  static async compressImage(
    imageBase64: string,
    quality = 80
  ): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const compressed = await sharp(buffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();
      
      return this.bufferToBase64(compressed);
    } catch (error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  /**
   * Convert image format
   */
  static async convertFormat(
    imageBase64: string,
    format: 'jpeg' | 'png' | 'webp'
  ): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      let converted: Buffer;

      switch (format) {
        case 'jpeg':
          converted = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
          break;
        case 'png':
          converted = await sharp(buffer).png().toBuffer();
          break;
        case 'webp':
          converted = await sharp(buffer).webp({ quality: 90 }).toBuffer();
          break;
      }

      return this.bufferToBase64(converted, `image/${format}`);
    } catch (error) {
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }

  /**
   * Enhance image (auto-adjust brightness and contrast)
   */
  static async enhanceImage(imageBase64: string): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const enhanced = await sharp(buffer)
        .normalize() // Auto-adjust brightness and contrast
        .sharpen()
        .jpeg({ quality: 90 })
        .toBuffer();
      
      return this.bufferToBase64(enhanced);
    } catch (error) {
      throw new Error(`Image enhancement failed: ${error.message}`);
    }
  }

  /**
   * Crop image to specific region
   */
  static async cropImage(
    imageBase64: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const cropped = await sharp(buffer)
        .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      return this.bufferToBase64(cropped);
    } catch (error) {
      throw new Error(`Image crop failed: ${error.message}`);
    }
  }

  /**
   * Create thumbnail
   */
  static async createThumbnail(
    imageBase64: string,
    size = 150
  ): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const thumbnail = await sharp(buffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      return this.bufferToBase64(thumbnail);
    } catch (error) {
      throw new Error(`Thumbnail creation failed: ${error.message}`);
    }
  }

  /**
   * Get image metadata
   */
  static async getMetadata(imageBase64: string) {
    try {
      const buffer = this.base64ToBuffer(imageBase64);
      const metadata = await sharp(buffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha,
      };
    } catch (error) {
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }
}
