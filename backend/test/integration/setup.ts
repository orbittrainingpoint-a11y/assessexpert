import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration-test bootstrap. Boots a real Nest app pointed at whatever
 * DATABASE_URL is set in the environment when jest runs — that's the
 * dev DB locally. CI should point at a disposable Postgres.
 *
 * Required env at run time (read by the app boot):
 *   DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
 *
 * The integration suites assume the dev DB has a seeded organisation
 * to attach test fixtures to. If your seed doesn't include one, the
 * `ensureTestOrg()` helper creates one on first use.
 */
export async function bootApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}

/** Create (or reuse) a test organisation with a stable slug. */
export async function ensureTestOrg(prisma: PrismaService): Promise<string> {
  const slug = 'integration-test-org';
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const org = await prisma.organization.create({
    data: {
      name: 'Integration Test Org',
      slug,
      country: 'AE',
      industry: 'Software',
      tradingName: 'Integration Test',
      quizEnabled: true, // tests exercise the quiz path
    },
  });
  return org.id;
}

/** Wipe every Org-scoped row this test created. Called in afterAll. */
export async function cleanupTestOrg(prisma: PrismaService) {
  const org = await prisma.organization.findUnique({ where: { slug: 'integration-test-org' } });
  if (!org) return;

  // Order matters because of FK constraints. Sessions → answers → reports → sessions, then candidates, then org.
  const sessions = await prisma.examSession.findMany({ where: { organizationId: org.id }, select: { id: true } });
  const sessionIds = sessions.map(s => s.id);
  if (sessionIds.length > 0) {
    await prisma.examAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.report.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.sessionCandidate.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } });
  }
  await prisma.candidateRecord.deleteMany({ where: { organizationId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
}
