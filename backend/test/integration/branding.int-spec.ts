import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootApp, ensureTestOrg, cleanupTestOrg } from './setup';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration tests for the public branding endpoint. Verifies the
 * feature-flag contract end-to-end: schema → service → controller →
 * HTTP response.
 */
describe('GET /api/organizations/public/:id/branding (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;

  beforeAll(async () => {
    const booted = await bootApp();
    app = booted.app;
    prisma = booted.prisma;
    orgId = await ensureTestOrg(prisma);
  });

  afterAll(async () => {
    await cleanupTestOrg(prisma);
    await app.close();
  });

  it('returns public branding shape for a real org', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/organizations/public/${orgId}/branding`)
      .expect(200);
    expect(res.body).toMatchObject({
      organizationId: orgId,
      displayName: expect.any(String),
      legalName: expect.any(String),
      features: { quiz: true }, // ensureTestOrg enabled quiz
    });
  });

  it('reflects the quizEnabled flag flip', async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { quizEnabled: false } });
    const res = await request(app.getHttpServer())
      .get(`/api/organizations/public/${orgId}/branding`)
      .expect(200);
    expect(res.body.features.quiz).toBe(false);

    await prisma.organization.update({ where: { id: orgId }, data: { quizEnabled: true } });
    const res2 = await request(app.getHttpServer())
      .get(`/api/organizations/public/${orgId}/branding`)
      .expect(200);
    expect(res2.body.features.quiz).toBe(true);
  });

  it('404s on unknown org id (does not leak a default)', async () => {
    await request(app.getHttpServer())
      .get('/api/organizations/public/cm00000000000000000000000/branding')
      .expect(404);
  });
});
