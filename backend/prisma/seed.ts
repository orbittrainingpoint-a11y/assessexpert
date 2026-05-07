import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding assessexpert database...');

  // Super Admin
  const adminHash = await bcrypt.hash('Admin@assessexpert2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@assessexpert.ae' },
    update: {},
    create: {
      email: 'admin@assessexpert.ae',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+971500000001',
      status: 'ACTIVE',
      mfaEnabled: false,
    },
  });
  console.log('✅ Super Admin created:', admin.email);

  // Master Proctor
  const mpHash = await bcrypt.hash('MasterProctor@2026!', 12);
  const masterProctor = await prisma.user.upsert({
    where: { email: 'masterproctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'masterproctor@assessexpert.ae',
      passwordHash: mpHash,
      role: 'MASTER_PROCTOR',
      firstName: 'Master',
      lastName: 'Proctor',
      phone: '+971500000002',
      status: 'ACTIVE',
      mfaEnabled: false,
    },
  });
  console.log('✅ Master Proctor created:', masterProctor.email);

  // Exam Setup Master
  const esmHash = await bcrypt.hash('ExamSetup@2026!', 12);
  const examSetupMaster = await prisma.user.upsert({
    where: { email: 'examsetup@assessexpert.ae' },
    update: {},
    create: {
      email: 'examsetup@assessexpert.ae',
      passwordHash: esmHash,
      role: 'EXAM_SETUP_MASTER',
      firstName: 'Exam',
      lastName: 'Setup',
      phone: '+971500000003',
      status: 'ACTIVE',
      mfaEnabled: false,
    },
  });
  console.log('✅ Exam Setup Master created:', examSetupMaster.email);

  // Proctor
  const proctorHash = await bcrypt.hash('Proctor@2026!', 12);
  const proctor = await prisma.user.upsert({
    where: { email: 'proctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'proctor@assessexpert.ae',
      passwordHash: proctorHash,
      role: 'PROCTOR',
      firstName: 'Ali',
      lastName: 'Hassan',
      phone: '+971500000004',
      status: 'ACTIVE',
      mfaEnabled: false,
      certificationLevel: 'Senior',
      certificationDomains: ['Engineering', 'IT'],
      languages: ['en', 'ar'],
      timezone: 'Asia/Dubai',
      maxSessionsPerDay: 5,
    },
  });
  console.log('✅ Proctor created:', proctor.email);

  // Sales Agent
  const salesHash = await bcrypt.hash('Sales@2026!', 12);
  const salesAgent = await prisma.user.upsert({
    where: { email: 'sales@assessexpert.ae' },
    update: {},
    create: {
      email: 'sales@assessexpert.ae',
      passwordHash: salesHash,
      role: 'SALES_AGENT',
      firstName: 'Sales',
      lastName: 'Agent',
      phone: '+971500000005',
      status: 'ACTIVE',
      region: 'GCC',
    },
  });
  console.log('✅ Sales Agent created:', salesAgent.email);

  // Demo Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-company-ae' },
    update: {},
    create: {
      name: 'Demo Engineering Company',
      slug: 'demo-company-ae',
      country: 'UAE',
      city: 'Dubai',
      industry: 'Engineering',
      size: '51-200',
      status: 'ACTIVE',
      contractStartDate: new Date(),
      contractEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      assessmentCredits: 100,
      assignedSalesAgentId: salesAgent.id,
      primaryContactEmail: 'hr@democompany.ae',
      accountTier: 'STANDARD',
    },
  });
  console.log('✅ Demo Organization created:', org.name);

  // HR Manager
  const hrHash = await bcrypt.hash('HRManager@2026!', 12);
  const hrManager = await prisma.user.upsert({
    where: { email: 'hr@democompany.ae' },
    update: {},
    create: {
      email: 'hr@democompany.ae',
      passwordHash: hrHash,
      role: 'HR_MANAGER',
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+971500000006',
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });
  console.log('✅ HR Manager created:', hrManager.email);

  // Assessment Types
  const assessmentTypes = [
    { name: 'AutoCAD Draftsman Level 1', shortCode: 'ACAD-L1', category: 'Engineering', industry: 'Construction', jobRole: 'AutoCAD Draftsman', practicalType: 'CAD' as const },
    { name: 'AutoCAD Draftsman Level 2', shortCode: 'ACAD-L2', category: 'Engineering', industry: 'Construction', jobRole: 'Senior AutoCAD Draftsman', practicalType: 'CAD' as const },
    { name: 'BIM Coordinator Level 1', shortCode: 'BIM-L1', category: 'Engineering', industry: 'Construction', jobRole: 'BIM Coordinator', practicalType: 'CAD' as const },
    { name: 'BIM Coordinator Level 2', shortCode: 'BIM-L2', category: 'Engineering', industry: 'Construction', jobRole: 'Senior BIM Coordinator', practicalType: 'CAD' as const },
    { name: 'Python Developer', shortCode: 'PY-DEV', category: 'IT', industry: 'Technology', jobRole: 'Python Developer', practicalType: 'CODING' as const },
    { name: 'JavaScript Developer', shortCode: 'JS-DEV', category: 'IT', industry: 'Technology', jobRole: 'JavaScript Developer', practicalType: 'CODING' as const },
    { name: 'Network Engineer', shortCode: 'NET-ENG', category: 'IT', industry: 'Technology', jobRole: 'Network Engineer', practicalType: 'LAB' as const },
    { name: 'HR Generalist', shortCode: 'HR-GEN', category: 'HR', industry: 'General', jobRole: 'HR Generalist', practicalType: 'FILE' as const },
    { name: 'Accountant Level 1', shortCode: 'ACC-L1', category: 'Finance', industry: 'Finance', jobRole: 'Accountant', practicalType: 'FILE' as const },
    { name: 'Project Manager', shortCode: 'PM-GEN', category: 'Operations', industry: 'General', jobRole: 'Project Manager', practicalType: 'FILE' as const },
  ];

  for (const at of assessmentTypes) {
    await prisma.assessmentType.upsert({
      where: { shortCode: at.shortCode },
      update: {},
      create: {
        ...at,
        description: `Professional assessment for ${at.jobRole} role`,
        mcqTimeLimit: 30,
        mcqQuestionCount: 25,
        mcqPassThreshold: 60,
        practicalTimeLimit: 60,
        practicalPassThreshold: 60,
        status: 'ACTIVE',
        createdBy: admin.id,
        languages: ['en'],
      },
    });
  }
  console.log('✅ Assessment types seeded:', assessmentTypes.length);

  // Sample questions for BIM-L2
  const bimType = await prisma.assessmentType.findUnique({ where: { shortCode: 'BIM-L2' } });
  if (bimType) {
    const sampleQuestions = [
      { text: 'In Autodesk Revit, what does "Workset" refer to?', options: ['A set of view templates applied to a model', 'A shared set of elements for collaborative work', 'A collection of sheets in a project browser', 'A group of families in the project library'], correct: ['B'], domain: 'Revit Fundamentals', difficulty: 'MEDIUM' as const },
      { text: 'What is the primary purpose of an IFC file in a BIM coordination workflow?', options: ['To store 2D drawing files for fabrication', 'To enable interoperability between different BIM software platforms', 'To define the project scheduling milestones', 'To manage construction budget allocations'], correct: ['B'], domain: 'IFC Standards', difficulty: 'MEDIUM' as const },
      { text: 'Which IFC entity is used to represent a structural column?', options: ['IfcBeam', 'IfcColumn', 'IfcWall', 'IfcSlab'], correct: ['B'], domain: 'IFC Standards', difficulty: 'EASY' as const },
      { text: 'What does LOD 300 represent in BIM?', options: ['Conceptual design', 'Approximate geometry', 'Precise geometry with specific assemblies', 'As-built documentation'], correct: ['C'], domain: 'BIM Standards', difficulty: 'MEDIUM' as const },
      { text: 'In Navisworks, what is a "Clash Detective" used for?', options: ['Detecting design errors in 2D drawings', 'Identifying spatial conflicts between building elements', 'Checking code compliance', 'Reviewing project schedules'], correct: ['B'], domain: 'Clash Detection', difficulty: 'EASY' as const },
    ];

    for (const [i, q] of sampleQuestions.entries()) {
      const existing = await prisma.question.findFirst({
        where: { assessmentTypeId: bimType.id, domain: q.domain, status: 'ACTIVE' },
      });
      if (!existing) {
        await prisma.question.create({
          data: {
            assessmentTypeId: bimType.id,
            type: 'MCQ_SINGLE',
            content: { text: q.text },
            options: q.options.map((o, idx) => ({ key: String.fromCharCode(65 + idx), text: o })),
            correctAnswer: q.correct,
            difficulty: q.difficulty,
            domain: q.domain,
            tags: [q.domain],
            marks: 1,
            language: 'en',
            status: 'ACTIVE',
            createdBy: examSetupMaster.id,
            version: 1,
          },
        });
      }
    }
    console.log('✅ Sample questions seeded for BIM-L2');
  }

  // Platform settings
  const defaultSettings = [
    { key: 'recording_retention_days', value: 7 },
    { key: 'fr_image_retention_days', value: 90 },
    { key: 'max_concurrent_sessions', value: 50 },
    { key: 'fr_similarity_threshold_verified', value: 90 },
    { key: 'fr_similarity_threshold_review', value: 70 },
    { key: 'fr_check_interval_seconds', value: 90 },
    { key: 'face_absence_threshold_seconds', value: 8 },
    { key: 'tab_switch_escalation_count', value: 3 },
    { key: 'min_proctor_narrative_chars', value: 50 },
    { key: 'report_sla_hours', value: 24 },
  ];

  for (const s of defaultSettings) {
    await prisma.platformSettings.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, updatedBy: admin.id },
    });
  }
  console.log('✅ Platform settings seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDefault credentials:');
  console.log('  Super Admin:      admin@assessexpert.ae / Admin@assessexpert2026!');
  console.log('  Master Proctor:   masterproctor@assessexpert.ae / MasterProctor@2026!');
  console.log('  Exam Setup:       examsetup@assessexpert.ae / ExamSetup@2026!');
  console.log('  Proctor:          proctor@assessexpert.ae / Proctor@2026!');
  console.log('  Sales Agent:      sales@assessexpert.ae / Sales@2026!');
  console.log('  HR Manager:       hr@democompany.ae / HRManager@2026!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
