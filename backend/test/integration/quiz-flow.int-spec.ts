import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomBytes } from 'crypto';
import { bootApp, ensureTestOrg, cleanupTestOrg } from './setup';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration test for the candidate-facing quiz endpoints. Seeds a
 * minimal quiz session + 2 MCQ questions, then drives the flow:
 *   getByToken → confirmEmail → (skip OTP step — verified in unit)
 *   → getQuestions → submit → getReport
 *
 * Covers the critical contract: scoring matches what the candidate
 * submitted, the session moves to REPORT_PUBLISHED, and HR's quiz
 * report endpoint surfaces the resulting row.
 */
describe('Quiz flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let assessmentTypeId: string;
  let candidateId: string;
  let sessionId: string;
  let magicToken: string;
  let q1Id: string;
  let q2Id: string;

  beforeAll(async () => {
    const booted = await bootApp();
    app = booted.app;
    prisma = booted.prisma;
    orgId = await ensureTestOrg(prisma);

    // Assessment type — minimal MCQ-only, no proctored bits.
    const at = await prisma.assessmentType.create({
      data: {
        name: 'Integration Test Quiz',
        shortCode: `INT-QUIZ-${Date.now()}`,
        category: 'TEST',
        industry: 'TEST',
        jobRole: 'TEST',
        mcqQuestionCount: 2,
        mcqTimeLimit: 15,
        mcqPassThreshold: 50,
        createdBy: 'integration-test',
      },
    });
    assessmentTypeId = at.id;

    // Two questions, both with single correct answer A.
    const q1 = await prisma.question.create({
      data: {
        assessmentType: { connect: { id: at.id } },
        createdBy: 'integration-test',
        type: 'MCQ_SINGLE' as any,
        content: { text: 'Test question 1' },
        options: [{ key: 'A', text: 'Correct' }, { key: 'B', text: 'Wrong' }],
        correctAnswer: ['A'],
        difficulty: 'EASY' as any,
        domain: 'Domain1',
      },
    });
    const q2 = await prisma.question.create({
      data: {
        assessmentType: { connect: { id: at.id } },
        createdBy: 'integration-test',
        type: 'MCQ_SINGLE' as any,
        content: { text: 'Test question 2' },
        options: [{ key: 'A', text: 'Correct' }, { key: 'B', text: 'Wrong' }],
        correctAnswer: ['A'],
        difficulty: 'EASY' as any,
        domain: 'Domain2',
      },
    });
    q1Id = q1.id;
    q2Id = q2.id;

    // Candidate.
    const cand = await prisma.candidateRecord.create({
      data: {
        organization: { connect: { id: orgId } },
        email: `int-test-${Date.now()}@example.com`,
        firstName: 'Integration',
        lastName: 'Tester',
        jobPosition: 'Test',
      },
    });
    candidateId = cand.id;

    // Quiz-mode session with magic token.
    magicToken = randomBytes(32).toString('hex');
    const session = await prisma.examSession.create({
      data: {
        assessmentType: { connect: { id: at.id } },
        candidate: { connect: { id: cand.id } },
        organization: { connect: { id: orgId } },
        scheduledAt: new Date(),
        magicToken,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'SCHEDULED' as any,
        mode: 'QUIZ',
        isMultiCandidate: false,
      },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    // Clean up the assessment type + questions we seeded above; the org
    // cleanup handles the session/candidate/answers/report.
    try {
      await prisma.question.deleteMany({ where: { assessmentTypeId } });
      await prisma.assessmentType.delete({ where: { id: assessmentTypeId } });
    } catch {}
    await cleanupTestOrg(prisma);
    await app.close();
  });

  it('getByToken returns the session shape with branding', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/quiz/public/by-token/${magicToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      id: sessionId,
      mode: 'QUIZ',
      assessmentType: { questionCount: 2 },
      organization: { displayName: expect.any(String) },
    });
  });

  it('confirmEmail rejects a wrong email', async () => {
    await request(app.getHttpServer())
      .post(`/api/quiz/public/${magicToken}/confirm-email`)
      .send({ email: 'wrong-email@example.com' })
      .expect(401);
  });

  it('confirmEmail accepts the real email + returns the full name', async () => {
    const cand = await prisma.candidateRecord.findUnique({ where: { id: candidateId } });
    const res = await request(app.getHttpServer())
      .post(`/api/quiz/public/${magicToken}/confirm-email`)
      .send({ email: cand!.email })
      .expect(201);
    expect(res.body).toMatchObject({
      confirmed: true,
      fullName: 'Integration Tester',
    });
  });

  it('getQuestions returns N questions and flips status to MCQ_IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/quiz/public/${magicToken}/questions`)
      .expect(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.durationMinutes).toBe(15);
    // Question shape should NOT leak correctAnswer to the candidate.
    expect(res.body.questions[0]).not.toHaveProperty('correctAnswer');

    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe('MCQ_IN_PROGRESS');
  });

  it('submit grades correctly + publishes the report + transitions session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/quiz/public/${magicToken}/submit`)
      .send({
        answers: [
          { questionId: q1Id, selected: ['A'] }, // correct
          { questionId: q2Id, selected: ['B'] }, // wrong
        ],
      })
      .expect(201);

    expect(res.body.submitted).toBe(true);
    expect(res.body.score).toMatchObject({
      totalScore: 1,
      maxTotal: 2,
      overallPercentage: 50,
      passingThreshold: 50,
      passed: true, // 50 >= 50
    });

    // Session moved to REPORT_PUBLISHED.
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    expect(session?.status).toBe('REPORT_PUBLISHED');

    // Report row exists.
    const report = await prisma.report.findFirst({ where: { sessionId } });
    expect(report).toBeTruthy();
    expect(report?.mcqScore).toBe(50);
    expect(report?.mcqPassed).toBe(true);

    // ExamAnswer rows attributed to the right candidate.
    const answers = await prisma.examAnswer.findMany({ where: { sessionId } });
    expect(answers).toHaveLength(2);
    expect(answers.every(a => a.candidateId === candidateId)).toBe(true);
  });

  it('re-submit is blocked (status is REPORT_PUBLISHED)', async () => {
    await request(app.getHttpServer())
      .post(`/api/quiz/public/${magicToken}/submit`)
      .send({ answers: [] })
      .expect(400);
  });

  it('OTP verify is atomic — concurrent verifies cannot both succeed', async () => {
    // Set up a fresh quiz session purely for this test.
    const otp = '424242';
    const { createHash } = await import('crypto');
    const otpHash = createHash('sha256').update(otp).digest('hex');

    const tmpSession = await prisma.examSession.create({
      data: {
        assessmentType: { connect: { id: assessmentTypeId } },
        candidate: { connect: { id: candidateId } },
        organization: { connect: { id: orgId } },
        scheduledAt: new Date(),
        magicToken: randomBytes(32).toString('hex'),
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'SCHEDULED' as any,
        mode: 'QUIZ',
        isMultiCandidate: false,
        quizOtpHash: otpHash,
        quizOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Fire two verify requests in parallel with the same OTP. The
    // atomic compare-and-swap should let exactly one win.
    const results = await Promise.allSettled([
      request(app.getHttpServer()).post(`/api/quiz/public/${tmpSession.magicToken}/verify-otp`).send({ otp }),
      request(app.getHttpServer()).post(`/api/quiz/public/${tmpSession.magicToken}/verify-otp`).send({ otp }),
    ]);
    const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : 500);
    // Exactly one 2xx, exactly one 4xx (401 = invalid code after the
    // race winner clears the hash).
    const successes = statuses.filter(s => s >= 200 && s < 300).length;
    const failures = statuses.filter(s => s >= 400).length;
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    // Cleanup the temp session.
    await prisma.examSession.delete({ where: { id: tmpSession.id } });
  });

  it('getReport returns the published report for the candidate', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/quiz/public/${magicToken}/report`)
      .expect(200);
    expect(res.body).toMatchObject({
      candidateName: 'Integration Tester',
      mcqScore: 50,
      overallResult: 'PASS',
    });
  });
});
