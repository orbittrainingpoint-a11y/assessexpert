import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Transcribes short audio chunks via Gemini's multimodal model.
 *
 * Used by the verification-conversation pipeline: each side records
 * ~8-second audio chunks of their mic and sends them here. Gemini
 * returns the spoken text, which the caller appends to the session's
 * verificationTranscript JSON.
 *
 * Returns null on any failure (missing key, network error, no speech).
 * Callers should silently skip null results rather than persisting noise.
 */
@Injectable()
export class AiTranscriptionService {
  private readonly logger = new Logger(AiTranscriptionService.name);
  private genAI: GoogleGenerativeAI;
  // Default model updated after gemini-1.5-flash was retired mid-2025.
  // Override via GEMINI_TRANSCRIBE_MODEL if the API SDK is upgraded to
  // support the newer 2.x tiers.
  private model = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.0-flash';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.warn('GEMINI_API_KEY not set — AI transcription is disabled');
      return null;
    }
    if (!audio || audio.length === 0) return null;

    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent([
        {
          inlineData: {
            data: audio.toString('base64'),
            mimeType: mimeType || 'audio/webm',
          },
        },
        {
          text:
            'Transcribe the spoken English in this short audio chunk VERBATIM. ' +
            'Return ONLY the spoken text with normal capitalisation and punctuation, ' +
            'nothing else. No headers, no quotes, no commentary. ' +
            'If there is silence, music, or no clearly audible speech, ' +
            'return an empty string.',
        },
      ]);
      const text = (result?.response?.text?.() || '').trim();
      // Strip Markdown fences if the model wrapped its response
      const cleaned = text
        .replace(/^```[\w]*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
      return cleaned || null;
    } catch (e: any) {
      this.logger.error('Gemini audio transcription failed: ' + (e?.message || e));
      return null;
    }
  }
}
