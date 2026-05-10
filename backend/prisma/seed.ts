import { PrismaClient, QuestionType, Difficulty, QuestionStatus, PracticalType, TaskStatus, AssessmentStatus, OrgStatus } from '@prisma/client';
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
      slug: 'assessexpert',
      country: 'UAE',
      city: 'Dubai',
      industry: 'Technology',
      address: 'Dubai, UAE',
      primaryContactEmail: 'admin@assessexpert.ae',
      primaryContactPhone: '+971-4-1234567',
      status: OrgStatus.ACTIVE,
      maxConcurrentSessions: 100,
      accountTier: 'ENTERPRISE',
    },
  });

  const demoCompanyOrg = await prisma.organization.upsert({
    where: { id: 'org-democompany' },
    update: {},
    create: {
      id: 'org-democompany',
      name: 'Demo Company',
      slug: 'democompany',
      country: 'UAE',
      city: 'Abu Dhabi',
      industry: 'Business Services',
      address: 'Abu Dhabi, UAE',
      primaryContactEmail: 'hr@democompany.ae',
      primaryContactPhone: '+971-4-7654321',
      status: OrgStatus.ACTIVE,
      maxConcurrentSessions: 20,
      accountTier: 'STANDARD',
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
      shortCode: 'FULLSTACK',
      category: 'Software Development',
      industry: 'Technology',
      jobRole: 'Full Stack Developer',
      description: 'Comprehensive assessment for Full Stack Developer position covering frontend, backend, and database skills.',
      mcqQuestionCount: 25,
      mcqTimeLimit: 45,
      practicalTimeLimit: 90,
      mcqPassThreshold: 60,
      practicalPassThreshold: 60,
      status: AssessmentStatus.ACTIVE,
      createdBy: 'system',
    },
  });

  const frontendAssessment = await prisma.assessmentType.upsert({
    where: { id: 'assess-frontend' },
    update: {},
    create: {
      id: 'assess-frontend',
      name: 'Frontend Developer',
      shortCode: 'FRONTEND',
      category: 'Software Development',
      industry: 'Technology',
      jobRole: 'Frontend Developer',
      description: 'Assessment for Frontend Developer position focusing on React, JavaScript, HTML, and CSS.',
      mcqQuestionCount: 25,
      mcqTimeLimit: 40,
      practicalTimeLimit: 60,
      mcqPassThreshold: 60,
      practicalPassThreshold: 60,
      status: AssessmentStatus.ACTIVE,
      createdBy: 'system',
    },
  });

  const backendAssessment = await prisma.assessmentType.upsert({
    where: { id: 'assess-backend' },
    update: {},
    create: {
      id: 'assess-backend',
      name: 'Backend Developer',
      shortCode: 'BACKEND',
      category: 'Software Development',
      industry: 'Technology',
      jobRole: 'Backend Developer',
      description: 'Assessment for Backend Developer position covering Node.js, databases, and API design.',
      mcqQuestionCount: 25,
      mcqTimeLimit: 40,
      practicalTimeLimit: 90,
      mcqPassThreshold: 60,
      practicalPassThreshold: 60,
      status: AssessmentStatus.ACTIVE,
      createdBy: 'system',
    },
  });

  console.log('✅ Assessment types created');

  // 4. Create Sample Questions
  console.log('Creating sample questions...');

  const questions = [
    {
      id: 'q1',
      assessmentTypeId: fullStackAssessment.id,
      type: QuestionType.MCQ_SINGLE,
      content: { text: 'What is the purpose of React hooks?' },
      options: [
        { key: 'A', text: 'To add state and lifecycle features to functional components' },
        { key: 'B', text: 'To style components' },
        { key: 'C', text: 'To create class components' },
        { key: 'D', text: 'To handle routing' },
      ],
      correctAnswer: ['A'],
      difficulty: Difficulty.MEDIUM,
      domain: 'Frontend',
      tags: ['React', 'Hooks'],
      createdBy: 'system',
    },
    {
      id: 'q2',
      assessmentTypeId: fullStackAssessment.id,
      type: QuestionType.MCQ_SINGLE,
      content: { text: 'Which HTTP method is used to update a resource?' },
      options: [
        { key: 'A', text: 'GET' },
        { key: 'B', text: 'POST' },
        { key: 'C', text: 'PUT' },
        { key: 'D', text: 'DELETE' },
      ],
      correctAnswer: ['C'],
      difficulty: Difficulty.EASY,
      domain: 'Backend',
      tags: ['HTTP', 'REST'],
      createdBy: 'system',
    },
    {
      id: 'q3',
      assessmentTypeId: fullStackAssessment.id,
      type: QuestionType.MCQ_SINGLE,
      content: { text: 'What does SQL stand for?' },
      options: [
        { key: 'A', text: 'Structured Query Language' },
        { key: 'B', text: 'Simple Query Language' },
        { key: 'C', text: 'Standard Query Language' },
        { key: 'D', text: 'System Query Language' },
      ],
      correctAnswer: ['A'],
      difficulty: Difficulty.EASY,
      domain: 'Database',
      tags: ['SQL', 'Database'],
      createdBy: 'system',
    },
    {
      id: 'q4',
      assessmentTypeId: fullStackAssessment.id,
      type: QuestionType.MCQ_SINGLE,
      content: { text: 'What is the purpose of middleware in Express.js?' },
      options: [
        { key: 'A', text: 'To handle database connections' },
        { key: 'B', text: 'To process requests before they reach route handlers' },
        { key: 'C', text: 'To render HTML templates' },
        { key: 'D', text: 'To manage sessions' },
      ],
      correctAnswer: ['B'],
      difficulty: Difficulty.MEDIUM,
      domain: 'Backend',
      tags: ['Express', 'Node.js'],
      createdBy: 'system',
    },
    {
      id: 'q5',
      assessmentTypeId: fullStackAssessment.id,
      type: QuestionType.MCQ_SINGLE,
      content: { text: 'Which of the following is NOT a JavaScript data type?' },
      options: [
        { key: 'A', text: 'String' },
        { key: 'B', text: 'Boolean' },
        { key: 'C', text: 'Character' },
        { key: 'D', text: 'Number' },
      ],
      correctAnswer: ['C'],
      difficulty: Difficulty.EASY,
      domain: 'Frontend',
      tags: ['JavaScript', 'Fundamentals'],
      createdBy: 'system',
    },
  ];

  for (const question of questions) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: {},
      create: {
        id: question.id,
        type: question.type,
        content: question.content,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        domain: question.domain,
        tags: question.tags,
        status: QuestionStatus.ACTIVE,
        createdBy: question.createdBy,
        assessmentType: {
          connect: { id: question.assessmentTypeId },
        },
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
        type: QuestionType.MCQ_SINGLE,
        content: { text: `Sample Question ${i} for Full Stack Developer` },
        options: [
          { key: 'A', text: 'Option A' },
          { key: 'B', text: 'Option B' },
          { key: 'C', text: 'Option C' },
          { key: 'D', text: 'Option D' },
        ],
        correctAnswer: ['A'],
        difficulty: i % 3 === 0 ? Difficulty.HARD : i % 2 === 0 ? Difficulty.MEDIUM : Difficulty.EASY,
        domain: 'General',
        tags: ['Sample'],
        status: QuestionStatus.ACTIVE,
        createdBy: 'system',
        assessmentType: {
          connect: { id: fullStackAssessment.id },
        },
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
      type: PracticalType.CODING,
      rubricData: { criteria: ['Functionality', 'Code Quality', 'Best Practices'] },
      acceptedFileTypes: ['.zip', '.js', '.ts'],
      status: TaskStatus.ACTIVE,
      createdBy: 'system',
      assessmentType: {
        connect: { id: fullStackAssessment.id },
      },
    },
  });

  await prisma.practicalTask.upsert({
    where: { id: 'task2' },
    update: {},
    create: {
      id: 'task2',
      title: 'React Component Development',
      description: 'Build a responsive dashboard component with charts and data tables using React.',
      type: PracticalType.CODING,
      rubricData: { criteria: ['UI/UX', 'Responsiveness', 'Code Quality'] },
      acceptedFileTypes: ['.zip', '.jsx', '.tsx'],
      status: TaskStatus.ACTIVE,
      createdBy: 'system',
      assessmentType: {
        connect: { id: frontendAssessment.id },
      },
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
      jobPosition: 'Full Stack Developer',
    },
    {
      id: 'cand2',
      firstName: 'Fatima',
      lastName: 'Ali',
      email: 'fatima.ali@example.com',
      phone: '+971-50-2345678',
      jobPosition: 'Frontend Developer',
    },
    {
      id: 'cand3',
      firstName: 'Mohammed',
      lastName: 'Khan',
      email: 'mohammed.khan@example.com',
      phone: '+971-50-3456789',
      jobPosition: 'Backend Developer',
    },
    {
      id: 'cand4',
      firstName: 'Sara',
      lastName: 'Ahmed',
      email: 'sara.ahmed@example.com',
      phone: '+971-50-4567890',
      jobPosition: 'Full Stack Developer',
    },
    {
      id: 'cand5',
      firstName: 'Omar',
      lastName: 'Ibrahim',
      email: 'omar.ibrahim@example.com',
      phone: '+971-50-5678901',
      jobPosition: 'Backend Developer',
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidateRecord.upsert({
      where: { id: candidate.id },
      update: {},
      create: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        jobPosition: candidate.jobPosition,
        organization: {
          connect: { id: demoCompanyOrg.id },
        },
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
