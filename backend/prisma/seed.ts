import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash password helper
  const hashPassword = async (password: string) => {
    return bcrypt.hash(password, 10);
  };

  // 1. Create Organizations
  console.log('Creating organizations...');
  
  const assessExpertOrg = await prisma.organization.upsert({
    where: { id: 'org-assessexpert' },
    update: {},
    create: {
      id: 'org-assessexpert',
      name: 'AssessExpert',
      contactEmail: 'admin@assessexpert.ae',
      contactPhone: '+971-4-1234567',
      address: 'Dubai, UAE',
      subscriptionTier: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      maxConcurrentSessions: 100,
      storageQuotaGB: 1000,
    },
  });

  const demoCompanyOrg = await prisma.organization.upsert({
    where: { id: 'org-democompany' },
    update: {},
    create: {
      id: 'org-democompany',
      name: 'Demo Company',
      contactEmail: 'hr@democompany.ae',
      contactPhone: '+971-4-7654321',
      address: 'Abu Dhabi, UAE',
      subscriptionTier: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      maxConcurrentSessions: 20,
      storageQuotaGB: 100,
    },
  });

  console.log('✅ Organizations created');

  // 2. Create Users
  console.log('Creating users...');

  // Super Admin
  await prisma.user.upsert({
    where: { email: 'admin@assessexpert.ae' },
    update: {},
    create: {
      email: 'admin@assessexpert.ae',
      passwordHash: await hashPassword('Admin@assessexpert2026!'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      organizationId: assessExpertOrg.id,
    },
  });

  // Master Proctor
  await prisma.user.upsert({
    where: { email: 'masterproctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'masterproctor@assessexpert.ae',
      passwordHash: await hashPassword('MasterProctor@2026!'),
      firstName: 'Master',
      lastName: 'Proctor',
      role: 'MASTER_PROCTOR',
      organizationId: assessExpertOrg.id,
    },
  });

  // Exam Setup (using ORG_ADMIN role)
  await prisma.user.upsert({
    where: { email: 'examsetup@assessexpert.ae' },
    update: {},
    create: {
      email: 'examsetup@assessexpert.ae',
      passwordHash: await hashPassword('ExamSetup@2026!'),
      firstName: 'Exam',
      lastName: 'Setup',
      role: 'ORG_ADMIN',
      organizationId: assessExpertOrg.id,
    },
  });

  // Proctor
  await prisma.user.upsert({
    where: { email: 'proctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'proctor@assessexpert.ae',
      passwordHash: await hashPassword('Proctor@2026!'),
      firstName: 'John',
      lastName: 'Proctor',
      role: 'PROCTOR',
      organizationId: assessExpertOrg.id,
    },
  });

  // Sales (using ORG_ADMIN role)
  await prisma.user.upsert({
    where: { email: 'sales@assessexpert.ae' },
    update: {},
    create: {
      email: 'sales@assessexpert.ae',
      passwordHash: await hashPassword('Sales@2026!'),
      firstName: 'Sales',
      lastName: 'Manager',
      role: 'ORG_ADMIN',
      organizationId: assessExpertOrg.id,
    },
  });

  // HR Manager
  await prisma.user.upsert({
    where: { email: 'hr@democompany.ae' },
    update: {},
    create: {
      email: 'hr@democompany.ae',
      passwordHash: await hashPassword('HRManager@2026!'),
      firstName: 'HR',
      lastName: 'Manager',
      role: 'HR_MANAGER',
      organizationId: demoCompanyOrg.id,
    },
  });

  console.log('✅ Users created');

  // 3. Create Assessment Types
  console.log('Creating assessment types...');

  const fullStackAssessment = await prisma.assessmentType.upsert({
    where: { id: 'assess-fullstack' },
    update: {},
    create: {
      id: 'assess-fullstack',
      name: 'Full Stack Developer',
      description: 'Comprehensive assessment for Full Stack Developer position covering frontend, backend, and database skills.',
      mcqCount: 25,
      mcqDurationMinutes: 45,
      practicalDurationMinutes: 90,
      passingScorePercentage: 60,
      status: 'ACTIVE',
    },
  });

  const frontendAssessment = await prisma.assessmentType.upsert({
    where: { id: 'assess-frontend' },
    update: {},
    create: {
      id: 'assess-frontend',
      name: 'Frontend Developer',
      description: 'Assessment for Frontend Developer position focusing on React, JavaScript, HTML, and CSS.',
      mcqCount: 25,
      mcqDurationMinutes: 40,
      practicalDurationMinutes: 60,
      passingScorePercentage: 60,
      status: 'ACTIVE',
    },
  });

  const backendAssessment = await prisma.assessmentType.upsert({
    where: { id: 'assess-backend' },
    update: {},
    create: {
      id: 'assess-backend',
      name: 'Backend Developer',
      description: 'Assessment for Backend Developer position covering Node.js, databases, and API design.',
      mcqCount: 25,
      mcqDurationMinutes: 40,
      practicalDurationMinutes: 90,
      passingScorePercentage: 60,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Assessment types created');

  // 4. Create Sample Questions
  console.log('Creating sample questions...');

  const questions = [
    {
      id: 'q1',
      assessmentTypeId: fullStackAssessment.id,
      content: { text: 'What is the purpose of React hooks?' },
      options: [
        { key: 'A', text: 'To add state and lifecycle features to functional components' },
        { key: 'B', text: 'To style components' },
        { key: 'C', text: 'To create class components' },
        { key: 'D', text: 'To handle routing' },
      ],
      correctAnswer: 'A',
      difficulty: 'MEDIUM',
    },
    {
      id: 'q2',
      assessmentTypeId: fullStackAssessment.id,
      content: { text: 'Which HTTP method is used to update a resource?' },
      options: [
        { key: 'A', text: 'GET' },
        { key: 'B', text: 'POST' },
        { key: 'C', text: 'PUT' },
        { key: 'D', text: 'DELETE' },
      ],
      correctAnswer: 'C',
      difficulty: 'EASY',
    },
    {
      id: 'q3',
      assessmentTypeId: fullStackAssessment.id,
      content: { text: 'What does SQL stand for?' },
      options: [
        { key: 'A', text: 'Structured Query Language' },
        { key: 'B', text: 'Simple Query Language' },
        { key: 'C', text: 'Standard Query Language' },
        { key: 'D', text: 'System Query Language' },
      ],
      correctAnswer: 'A',
      difficulty: 'EASY',
    },
    {
      id: 'q4',
      assessmentTypeId: fullStackAssessment.id,
      content: { text: 'What is the purpose of middleware in Express.js?' },
      options: [
        { key: 'A', text: 'To handle database connections' },
        { key: 'B', text: 'To process requests before they reach route handlers' },
        { key: 'C', text: 'To render HTML templates' },
        { key: 'D', text: 'To manage sessions' },
      ],
      correctAnswer: 'B',
      difficulty: 'MEDIUM',
    },
    {
      id: 'q5',
      assessmentTypeId: fullStackAssessment.id,
      content: { text: 'Which of the following is NOT a JavaScript data type?' },
      options: [
        { key: 'A', text: 'String' },
        { key: 'B', text: 'Boolean' },
        { key: 'C', text: 'Character' },
        { key: 'D', text: 'Number' },
      ],
      correctAnswer: 'C',
      difficulty: 'EASY',
    },
  ];

  for (const question of questions) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: {},
      create: {
        ...question,
        status: 'ACTIVE',
      },
    });
  }

  // Create more questions to reach 25+ per assessment
  for (let i = 6; i <= 30; i++) {
    await prisma.question.upsert({
      where: { id: `q${i}` },
      update: {},
      create: {
        id: `q${i}`,
        assessmentTypeId: fullStackAssessment.id,
        content: { text: `Sample Question ${i} for Full Stack Developer` },
        options: [
          { key: 'A', text: 'Option A' },
          { key: 'B', text: 'Option B' },
          { key: 'C', text: 'Option C' },
          { key: 'D', text: 'Option D' },
        ],
        correctAnswer: 'A',
        difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY',
        status: 'ACTIVE',
      },
    });
  }

  console.log('✅ Questions created');

  // 5. Create Practical Tasks
  console.log('Creating practical tasks...');

  await prisma.practicalTask.upsert({
    where: { id: 'task1' },
    update: {},
    create: {
      id: 'task1',
      title: 'Build a REST API',
      description: 'Create a RESTful API with CRUD operations for a Todo application using Node.js and Express.',
      assessmentTypeId: fullStackAssessment.id,
      acceptedFileTypes: ['.zip', '.js', '.ts'],
      maxFileSizeMB: 10,
      status: 'ACTIVE',
    },
  });

  await prisma.practicalTask.upsert({
    where: { id: 'task2' },
    update: {},
    create: {
      id: 'task2',
      title: 'React Component Development',
      description: 'Build a responsive dashboard component with charts and data tables using React.',
      assessmentTypeId: frontendAssessment.id,
      acceptedFileTypes: ['.zip', '.jsx', '.tsx'],
      maxFileSizeMB: 10,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Practical tasks created');

  // 6. Create Sample Candidates
  console.log('Creating sample candidates...');

  const candidates = [
    {
      id: 'cand1',
      firstName: 'Ahmed',
      lastName: 'Hassan',
      email: 'ahmed.hassan@example.com',
      phone: '+971-50-1234567',
    },
    {
      id: 'cand2',
      firstName: 'Fatima',
      lastName: 'Ali',
      email: 'fatima.ali@example.com',
      phone: '+971-50-2345678',
    },
    {
      id: 'cand3',
      firstName: 'Mohammed',
      lastName: 'Khan',
      email: 'mohammed.khan@example.com',
      phone: '+971-50-3456789',
    },
    {
      id: 'cand4',
      firstName: 'Sara',
      lastName: 'Ahmed',
      email: 'sara.ahmed@example.com',
      phone: '+971-50-4567890',
    },
    {
      id: 'cand5',
      firstName: 'Omar',
      lastName: 'Ibrahim',
      email: 'omar.ibrahim@example.com',
      phone: '+971-50-5678901',
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidateRecord.upsert({
      where: { id: candidate.id },
      update: {},
      create: {
        ...candidate,
        organizationId: demoCompanyOrg.id,
      },
    });
  }

  console.log('✅ Candidates created');

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Demo Credentials:');
  console.log('');
  console.log('Super Admin:');
  console.log('  Email: admin@assessexpert.ae');
  console.log('  Password: Admin@assessexpert2026!');
  console.log('');
  console.log('Master Proctor:');
  console.log('  Email: masterproctor@assessexpert.ae');
  console.log('  Password: MasterProctor@2026!');
  console.log('');
  console.log('Exam Setup:');
  console.log('  Email: examsetup@assessexpert.ae');
  console.log('  Password: ExamSetup@2026!');
  console.log('');
  console.log('Proctor:');
  console.log('  Email: proctor@assessexpert.ae');
  console.log('  Password: Proctor@2026!');
  console.log('');
  console.log('Sales:');
  console.log('  Email: sales@assessexpert.ae');
  console.log('  Password: Sales@2026!');
  console.log('');
  console.log('HR Manager:');
  console.log('  Email: hr@democompany.ae');
  console.log('  Password: HRManager@2026!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
