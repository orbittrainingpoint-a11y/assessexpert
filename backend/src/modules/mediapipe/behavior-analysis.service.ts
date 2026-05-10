import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface BehaviorScore {
  sessionId: string;
  overallScore: number; // 0-100
  multipleFacesCount: number;
  lookingAwayCount: number;
  handNearFaceCount: number;
  gazeOffscreenCount: number;
  faceAbsentCount: number;
  totalEvents: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface BehaviorPattern {
  type: string;
  frequency: number;
  lastOccurrence: Date;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

@Injectable()
export class BehaviorAnalysisService {
  private readonly logger = new Logger(BehaviorAnalysisService.name);

  constructor(private prismaService: PrismaService) {}

  /**
   * Calculate behavior score for a session
   */
  async calculateBehaviorScore(sessionId: string): Promise<BehaviorScore> {
    try {
      // Get all AI events for the session
      const events = await this.prismaService.sessionEvent.findMany({
        where: {
          sessionId,
          source: 'AI',
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      // Count events by type
      const multipleFacesCount = events.filter(e => e.eventType === 'FACE_MULTIPLE').length;
      const lookingAwayCount = events.filter(e => e.eventType === 'GAZE_OFFSCREEN').length;
      const handNearFaceCount = events.filter(e => e.eventType === 'AUDIO_ANOMALY').length;
      const gazeOffscreenCount = lookingAwayCount; // Same as looking away
      const faceAbsentCount = events.filter(e => e.eventType === 'FACE_ABSENT').length;

      const totalEvents = events.length;

      // Calculate score (start at 100, deduct points for violations)
      let score = 100;
      
      // Critical violations (heavy penalty)
      score -= multipleFacesCount * 15; // -15 per multiple faces
      score -= faceAbsentCount * 20; // -20 per absence

      // Warning violations (moderate penalty)
      score -= lookingAwayCount * 5; // -5 per looking away
      score -= handNearFaceCount * 8; // -8 per hand near face
      score -= gazeOffscreenCount * 5; // -5 per gaze offscreen

      // Ensure score doesn't go below 0
      score = Math.max(0, score);

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (score >= 80) riskLevel = 'LOW';
      else if (score >= 60) riskLevel = 'MEDIUM';
      else if (score >= 40) riskLevel = 'HIGH';
      else riskLevel = 'CRITICAL';

      return {
        sessionId,
        overallScore: Math.round(score),
        multipleFacesCount,
        lookingAwayCount,
        handNearFaceCount,
        gazeOffscreenCount,
        faceAbsentCount,
        totalEvents,
        riskLevel,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate behavior score for session ${sessionId}:`, error.message);
      return {
        sessionId,
        overallScore: 100,
        multipleFacesCount: 0,
        lookingAwayCount: 0,
        handNearFaceCount: 0,
        gazeOffscreenCount: 0,
        faceAbsentCount: 0,
        totalEvents: 0,
        riskLevel: 'LOW',
      };
    }
  }

  /**
   * Identify behavior patterns
   */
  async identifyPatterns(sessionId: string): Promise<BehaviorPattern[]> {
    try {
      const events = await this.prismaService.sessionEvent.findMany({
        where: {
          sessionId,
          source: 'AI',
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Group events by type
      const eventsByType = new Map<string, any[]>();
      for (const event of events) {
        const type = event.eventType;
        if (!eventsByType.has(type)) {
          eventsByType.set(type, []);
        }
        eventsByType.get(type)!.push(event);
      }

      // Analyze patterns
      const patterns: BehaviorPattern[] = [];

      for (const [type, typeEvents] of eventsByType.entries()) {
        const frequency = typeEvents.length;
        const lastOccurrence = typeEvents[typeEvents.length - 1].timestamp;
        
        // Determine severity based on frequency
        let severity: 'INFO' | 'WARNING' | 'CRITICAL';
        if (frequency >= 5) severity = 'CRITICAL';
        else if (frequency >= 3) severity = 'WARNING';
        else severity = 'INFO';

        patterns.push({
          type,
          frequency,
          lastOccurrence,
          severity,
        });
      }

      // Sort by frequency (most frequent first)
      patterns.sort((a, b) => b.frequency - a.frequency);

      return patterns;
    } catch (error) {
      this.logger.error(`Failed to identify patterns for session ${sessionId}:`, error.message);
      return [];
    }
  }

  /**
   * Generate behavior summary for report
   */
  async generateBehaviorSummary(sessionId: string): Promise<{
    score: BehaviorScore;
    patterns: BehaviorPattern[];
    summary: string;
    recommendations: string[];
  }> {
    const score = await this.calculateBehaviorScore(sessionId);
    const patterns = await this.identifyPatterns(sessionId);

    // Generate summary text
    let summary = '';
    if (score.riskLevel === 'LOW') {
      summary = 'Candidate demonstrated excellent behavior throughout the assessment with minimal violations.';
    } else if (score.riskLevel === 'MEDIUM') {
      summary = 'Candidate showed some concerning behaviors that warrant review.';
    } else if (score.riskLevel === 'HIGH') {
      summary = 'Candidate exhibited multiple violations that raise significant concerns about assessment integrity.';
    } else {
      summary = 'CRITICAL: Candidate behavior indicates high probability of cheating or policy violations.';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (score.multipleFacesCount > 0) {
      recommendations.push(`Multiple faces detected ${score.multipleFacesCount} time(s) - Review for unauthorized assistance`);
    }
    
    if (score.faceAbsentCount > 0) {
      recommendations.push(`Candidate left frame ${score.faceAbsentCount} time(s) - Verify reason for absence`);
    }
    
    if (score.lookingAwayCount > 3) {
      recommendations.push(`Frequent looking away (${score.lookingAwayCount} times) - Possible secondary screen usage`);
    }
    
    if (score.handNearFaceCount > 2) {
      recommendations.push(`Hand near face detected ${score.handNearFaceCount} time(s) - Possible phone usage`);
    }

    if (recommendations.length === 0) {
      recommendations.push('No significant concerns identified');
    }

    return {
      score,
      patterns,
      summary,
      recommendations,
    };
  }

  /**
   * Update integrity score in session
   */
  async updateIntegrityScore(sessionId: string): Promise<number> {
    try {
      const behaviorScore = await this.calculateBehaviorScore(sessionId);
      
      // Update session with integrity score
      await this.prismaService.examSession.update({
        where: { id: sessionId },
        data: { integrityScore: behaviorScore.overallScore },
      });

      return behaviorScore.overallScore;
    } catch (error) {
      this.logger.error(`Failed to update integrity score for session ${sessionId}:`, error.message);
      return 100;
    }
  }

  /**
   * Get real-time behavior status
   */
  async getRealTimeStatus(sessionId: string): Promise<{
    currentScore: number;
    recentEvents: number;
    riskLevel: string;
    lastViolation: Date | null;
  }> {
    try {
      const score = await this.calculateBehaviorScore(sessionId);
      
      // Get recent events (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentEvents = await this.prismaService.sessionEvent.count({
        where: {
          sessionId,
          source: 'AI',
          timestamp: { gte: fiveMinutesAgo },
        },
      });

      // Get last violation
      const lastEvent = await this.prismaService.sessionEvent.findFirst({
        where: {
          sessionId,
          source: 'AI',
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return {
        currentScore: score.overallScore,
        recentEvents,
        riskLevel: score.riskLevel,
        lastViolation: lastEvent?.timestamp || null,
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time status for session ${sessionId}:`, error.message);
      return {
        currentScore: 100,
        recentEvents: 0,
        riskLevel: 'LOW',
        lastViolation: null,
      };
    }
  }
}
