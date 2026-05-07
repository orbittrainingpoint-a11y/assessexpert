import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GradingService {
  constructor(private prisma: PrismaService) {}

  async gradeMcq(sessionId: string) {
    const answers = await this.prisma.examAnswer.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
    });

    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { assessmentType: true },
    });

    const totalMarks = answers.reduce((sum, a) => sum + a.marks, 0);
    const maxMarks = answers.reduce((sum, a) => sum + a.maxMarks, 0);
    const score = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    const passed = score >= (session?.assessmentType.mcqPassThreshold || 60);

    return {
      sessionId,
      totalCorrect: answers.filter(a => a.isCorrect).length,
      totalQuestions: answers.length,
      score: Math.round(score * 10) / 10,
      passed,
      answers: answers.map(a => ({
        position: a.position,
        isCorrect: a.isCorrect,
        marks: a.marks,
        maxMarks: a.maxMarks,
        timeSpentSeconds: a.timeSpentSeconds,
      })),
    };
  }

  async getMcqSummary(sessionId: string) {
    return this.gradeMcq(sessionId);
  }
}
