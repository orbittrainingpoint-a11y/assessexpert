import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting Ahmed Al-Rashidi demo session...');

  const org = await prisma.organization.findUnique({ where: { slug: 'demo-company-ae' } });
  const assessmentType = await prisma.assessmentType.findFirst({ where: { shortCode: 'ACAD-L1' } })
    ?? await prisma.assessmentType.findFirst();
  const proctor = await prisma.user.findUnique({ where: { email: 'proctor@assessexpert.ae' } });

  if (!org || !assessmentType || !proctor) {
    throw new Error('Required data not found. Run main seed first.');
  }

  // Upsert candidate
  const candidate = await prisma.candidateRecord.upsert({
    where: { email_organizationId: { email: 'ahmed.alrashidi@example.com', organizationId: org.id } },
    update: {},
    create: {
      email: 'ahmed.alrashidi@example.com',
      firstName: 'Ahmed',
      lastName: 'Al-Rashidi',
      phone: '+971501234567',
      jobPosition: 'CAD Drafter',
      yearsExperience: '3-5',
      department: 'Engineering',
      organizationId: org.id,
      source: 'MANUAL',
      notes: 'Demo candidate for testing',
    },
  });

  const magicToken = 'DEMO-AHMED-2026-ACAD-L1-TOKEN';

  // Always reset to fresh state — scheduledAt = now, token not used, status = SCHEDULED
  const session = await prisma.examSession.upsert({
    where: { magicToken },
    update: {
      scheduledAt: new Date(),                                          // now — always open
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      tokenUsedAt: null,                                                // reset used flag
      status: 'SCHEDULED',
      proctorId: proctor.id,
    },
    create: {
      assessmentTypeId: assessmentType.id,
      candidateId: candidate.id,
      organizationId: org.id,
      proctorId: proctor.id,
      scheduledAt: new Date(),
      magicToken,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    },
  });

  console.log('\n✅ Demo session reset successfully!');
  console.log('\n📧 Candidate Email : ahmed.alrashidi@example.com');
  console.log('🔗 Magic Link      : http://localhost:3000/exam?token=DEMO-AHMED-2026-ACAD-L1-TOKEN');
  console.log('👤 Proctor         : proctor@assessexpert.ae / Proctor@2026!');
  console.log('📋 Session ID      :', session.id);
  console.log('⏰ Scheduled At    : NOW (always open)');
  console.log('🔑 Token Expires   : 30 days from now');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
