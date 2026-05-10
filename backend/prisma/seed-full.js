const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed...');

  // ============================================================================
  // 1. ORGANIZATIONS
  // ============================================================================
  console.log('Creating organizations...');

  const assessExpertOrg = await prisma.organization.upsert({
    where: { slug: 'assessexpert' },
    update: {},
    create: {
      name: 'AssessExpert Platform',
      slug: 'assessexpert',
      country: 'UAE',
      city: 'Dubai',
      industry: 'Technology',
      size: '50-100',
      website: 'https://assessexpert.ae',
      status: 'ACTIVE',
      accountTier: 'ENTERPRISE',
      assessmentCredits: 1000,
      creditsUsed: 0,
      maxConcurrentSessions: 20,
      primaryContactName: 'Admin Team',
      primaryContactEmail: 'admin@assessexpert.ae',
      allowedAssessmentTypes: ['CAD', 'CODING', 'LAB'],
    },
  });

  const demoCompanyOrg = await prisma.organization.upsert({
    where: { slug: 'democompany' },
    update: {},
    create: {
      name: 'Demo Company Ltd',
      slug: 'democompany',
      tradingName: 'Demo Corp',
      country: 'UAE',
      city: 'Abu Dhabi',
      industry: 'Manufacturing',
      size: '100-500',
      website: 'https://democompany.ae',
      status: 'ACTIVE',
      accountTier: 'STANDARD',
      assessmentCredits: 500,
      creditsUsed: 25,
      maxConcurrentSessions: 10,
      primaryContactName: 'HR Manager',
      primaryContactEmail: 'hr@democompany.ae',
      allowedAssessmentTypes: ['CAD', 'CODING'],
    },
  });

  const techCorpOrg = await prisma.organization.upsert({
    where: { slug: 'techcorp' },
    update: {},
    create: {
      name: 'TechCorp Solutions',
      slug: 'techcorp',
      country: 'UAE',
      city: 'Sharjah',
      industry: 'IT Services',
      size: '500-1000',
      website: 'https://techcorp.ae',
      status: 'ACTIVE',
      accountTier: 'PREMIUM',
      assessmentCredits: 750,
      creditsUsed: 150,
      maxConcurrentSessions: 15,
      primaryContactName: 'Tech HR',
      primaryContactEmail: 'hr@techcorp.ae',
      allowedAssessmentTypes: ['CODING', 'LAB'],
    },
  });

  console.log('✅ Organizations created');

  // ============================================================================
  // 2. USERS
  // ============================================================================
  console.log('Creating users...');

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@assessexpert.ae' },
    update: {},
    create: {
      email: 'admin@assessexpert.ae',
      passwordHash: await bcrypt.hash('Admin@assessexpert2026!', 10),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  // Master Proctor
  const masterProctor = await prisma.user.upsert({
    where: { email: 'masterproctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'masterproctor@assessexpert.ae',
      passwordHash: await bcrypt.hash('MasterProctor@2026!', 10),
      firstName: 'Master',
      lastName: 'Proctor',
      role: 'MASTER_PROCTOR',
      status: 'ACTIVE',
      certificationLevel: 'SENIOR',
      certificationDomains: ['CAD', 'CODING', 'LAB'],
      languages: ['en', 'ar'],
      maxSessionsPerDay: 8,
    },
  });

  // Exam Setup Master
  const examSetup = await prisma.user.upsert({
    where: { email: 'examsetup@assessexpert.ae' },
    update: {},
    create: {
      email: 'examsetup@assessexpert.ae',
      passwordHash: await bcrypt.hash('ExamSetup@2026!', 10),
      firstName: 'Exam',
      lastName: 'Setup',
      role: 'EXAM_SETUP_MASTER',
      status: 'ACTIVE',
    },
  });

  // Proctor
  const proctor = await prisma.user.upsert({
    where: { email: 'proctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'proctor@assessexpert.ae',
      passwordHash: await bcrypt.hash('Proctor@2026!', 10),
      firstName: 'John',
      lastName: 'Proctor',
      role: 'PROCTOR',
      status: 'ACTIVE',
      certificationLevel: 'INTERMEDIATE',
      certificationDomains: ['CAD', 'CODING'],
      languages: ['en'],
      maxSessionsPerDay: 6,
    },
  });

  // Sales Agent
  const sales = await prisma.user.upsert({
    where: { email: 'sales@assessexpert.ae' },
    update: {},
    create: {
      email: 'sales@assessexpert.ae',
      passwordHash: await bcrypt.hash('Sales@2026!', 10),
      firstName: 'Sales',
      lastName: 'Manager',
      role: 'SALES_AGENT',
      status: 'ACTIVE',
    },
  });

  // HR Manager - Demo Company
  const hrDemo = await prisma.user.upsert({
    where: { email: 'hr@democompany.ae' },
    update: {},
    create: {
      email: 'hr@democompany.ae',
      passwordHash: await bcrypt.hash('HRManager@2026!', 10),
      firstName: 'HR',
      lastName: 'Manager',
      role: 'HR_MANAGER',
      organizationId: demoCompanyOrg.id,
      status: 'ACTIVE',
    },
  });

  // Org Admin - Demo Company
  const orgAdminDemo = await prisma.user.upsert({
    where: { email: 'admin@democompany.ae' },
    update: {},
    create: {
      email: 'admin@democompany.ae',
      passwordHash: await bcrypt.hash('OrgAdmin@2026!', 10),
      firstName: 'Org',
      lastName: 'Admin',
      role: 'ORG_ADMIN',
      organizationId: demoCompanyOrg.id,
      status: 'ACTIVE',
    },
  });

  // HR Manager - TechCorp
  const hrTech = await prisma.user.upsert({
    where: { email: 'hr@techcorp.ae' },
    update: {},
    create: {
      email: 'hr@techcorp.ae',
      passwordHash: await bcrypt.hash('TechHR@2026!', 10),
      firstName: 'Tech',
      lastName: 'HR',
      role: 'HR_MANAGER',
      organizationId: techCorpOrg.id,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users created');

  // ============================================================================
  // 3. ASSESSMENT TYPES
  // ============================================================================
  console.log('Creating assessment types...');

  const autocadAssessment = await prisma.assessmentType.upsert({
    where: { shortCode: 'ACAD-2D-BASIC' },
    update: {},
    create: {
      name: 'AutoCAD 2D Drafter - Basic',
      shortCode: 'ACAD-2D-BASIC',
      category: 'CAD',
      industry: 'Engineering',
      jobRole: 'CAD Drafter',
      description: 'Basic 2D drafting skills assessment for AutoCAD',
      mcqTimeLimit: 30,
      mcqQuestionCount: 25,
      mcqPassThreshold: 60.0,
      practicalType: 'CAD',
      practicalTimeLimit: 60,
      practicalPassThreshold: 60.0,
      mcqWeight: 40.0,
      practicalWeight: 60.0,
      overallPassLogic: 'BOTH',
      overallPassThreshold: 60.0,
      requiresGuardPro: true,
      blockMultiMonitor: true,
      blockVirtualMachines: true,
      allowClipboard: false,
      languages: ['en'],
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  const pythonAssessment = await prisma.assessmentType.upsert({
    where: { shortCode: 'PY-DEV-INT' },
    update: {},
    create: {
      name: 'Python Developer - Intermediate',
      shortCode: 'PY-DEV-INT',
      category: 'CODING',
      industry: 'Technology',
      jobRole: 'Python Developer',
      description: 'Intermediate Python programming assessment',
      mcqTimeLimit: 40,
      mcqQuestionCount: 30,
      mcqPassThreshold: 65.0,
      practicalType: 'CODING',
      practicalTimeLimit: 90,
      practicalPassThreshold: 65.0,
      mcqWeight: 35.0,
      practicalWeight: 65.0,
      overallPassLogic: 'BOTH',
      overallPassThreshold: 65.0,
      requiresGuardPro: true,
      blockMultiMonitor: true,
      blockVirtualMachines: true,
      allowClipboard: false,
      languages: ['en'],
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  const reactAssessment = await prisma.assessmentType.upsert({
    where: { shortCode: 'REACT-FE-ADV' },
    update: {},
    create: {
      name: 'React Frontend Developer - Advanced',
      shortCode: 'REACT-FE-ADV',
      category: 'CODING',
      industry: 'Technology',
      jobRole: 'Frontend Developer',
      description: 'Advanced React.js and frontend development assessment',
      mcqTimeLimit: 35,
      mcqQuestionCount: 25,
      mcqPassThreshold: 70.0,
      practicalType: 'CODING',
      practicalTimeLimit: 120,
      practicalPassThreshold: 70.0,
      mcqWeight: 30.0,
      practicalWeight: 70.0,
      overallPassLogic: 'BOTH',
      overallPassThreshold: 70.0,
      requiresGuardPro: true,
      blockMultiMonitor: true,
      blockVirtualMachines: true,
      allowClipboard: false,
      languages: ['en'],
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  console.log('✅ Assessment types created');

  // ============================================================================
  // 4. QUESTIONS (MCQ)
  // ============================================================================
  console.log('Creating questions...');

  // AutoCAD Questions
  const autocadQuestions = [
    {
      content: { text: 'What is the keyboard shortcut for the LINE command in AutoCAD?' },
      options: [
        { key: 'A', text: 'L' },
        { key: 'B', text: 'LN' },
        { key: 'C', text: 'LINE' },
        { key: 'D', text: 'LI' },
      ],
      correctAnswer: ['A'],
      difficulty: 'EASY',
      domain: 'Basic Commands',
    },
    {
      content: { text: 'Which command is used to create a copy of an object at a specified distance?' },
      options: [
        { key: 'A', text: 'COPY' },
        { key: 'B', text: 'OFFSET' },
        { key: 'C', text: 'MIRROR' },
        { key: 'D', text: 'ARRAY' },
      ],
      correctAnswer: ['B'],
      difficulty: 'EASY',
      domain: 'Modify Commands',
    },
    {
      content: { text: 'What does the TRIM command do in AutoCAD?' },
      options: [
        { key: 'A', text: 'Extends objects to meet another object' },
        { key: 'B', text: 'Cuts objects at specified cutting edges' },
        { key: 'C', text: 'Removes duplicate objects' },
        { key: 'D', text: 'Reduces file size' },
      ],
      correctAnswer: ['B'],
      difficulty: 'MEDIUM',
      domain: 'Modify Commands',
    },
  ];

  for (const q of autocadQuestions) {
    await prisma.question.create({
      data: {
        assessmentTypeId: autocadAssessment.id,
        type: 'MCQ_SINGLE',
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        domain: q.domain,
        marks: 1.0,
        status: 'ACTIVE',
        createdBy: examSetup.id,
      },
    });
  }

  // Python Questions
  const pythonQuestions = [
    {
      content: { text: 'What is the output of: print(type([]) == list)?' },
      options: [
        { key: 'A', text: 'True' },
        { key: 'B', text: 'False' },
        { key: 'C', text: 'list' },
        { key: 'D', text: 'Error' },
      ],
      correctAnswer: ['A'],
      difficulty: 'EASY',
      domain: 'Data Types',
    },
    {
      content: { text: 'Which method is used to add an element to the end of a list?' },
      options: [
        { key: 'A', text: 'add()' },
        { key: 'B', text: 'append()' },
        { key: 'C', text: 'insert()' },
        { key: 'D', text: 'extend()' },
      ],
      correctAnswer: ['B'],
      difficulty: 'EASY',
      domain: 'Lists',
    },
    {
      content: { text: 'What is a decorator in Python?' },
      options: [
        { key: 'A', text: 'A function that modifies another function' },
        { key: 'B', text: 'A class that inherits from another class' },
        { key: 'C', text: 'A variable that stores multiple values' },
        { key: 'D', text: 'A loop that iterates over a sequence' },
      ],
      correctAnswer: ['A'],
      difficulty: 'MEDIUM',
      domain: 'Advanced Concepts',
    },
  ];

  for (const q of pythonQuestions) {
    await prisma.question.create({
      data: {
        assessmentTypeId: pythonAssessment.id,
        type: 'MCQ_SINGLE',
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        domain: q.domain,
        marks: 1.0,
        status: 'ACTIVE',
        createdBy: examSetup.id,
      },
    });
  }

  // React Questions
  const reactQuestions = [
    {
      content: { text: 'What is the purpose of useEffect hook in React?' },
      options: [
        { key: 'A', text: 'To manage component state' },
        { key: 'B', text: 'To perform side effects in function components' },
        { key: 'C', text: 'To create context providers' },
        { key: 'D', text: 'To optimize rendering performance' },
      ],
      correctAnswer: ['B'],
      difficulty: 'MEDIUM',
      domain: 'React Hooks',
    },
    {
      content: { text: 'Which of the following is true about React keys?' },
      options: [
        { key: 'A', text: 'Keys should be unique among siblings' },
        { key: 'B', text: 'Keys must be globally unique' },
        { key: 'C', text: 'Keys are optional in lists' },
        { key: 'D', text: 'Keys can be any data type' },
      ],
      correctAnswer: ['A'],
      difficulty: 'MEDIUM',
      domain: 'Lists and Keys',
    },
    {
      content: { text: 'What is the Virtual DOM in React?' },
      options: [
        { key: 'A', text: 'A copy of the real DOM kept in memory' },
        { key: 'B', text: 'A browser API for DOM manipulation' },
        { key: 'C', text: 'A CSS framework for styling' },
        { key: 'D', text: 'A state management library' },
      ],
      correctAnswer: ['A'],
      difficulty: 'EASY',
      domain: 'Core Concepts',
    },
  ];

  for (const q of reactQuestions) {
    await prisma.question.create({
      data: {
        assessmentTypeId: reactAssessment.id,
        type: 'MCQ_SINGLE',
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        domain: q.domain,
        marks: 1.0,
        status: 'ACTIVE',
        createdBy: examSetup.id,
      },
    });
  }

  console.log('✅ Questions created');

  // ============================================================================
  // 5. PRACTICAL TASKS
  // ============================================================================
  console.log('Creating practical tasks...');

  await prisma.practicalTask.create({
    data: {
      assessmentTypeId: autocadAssessment.id,
      type: 'CAD',
      title: 'Draw a Simple Floor Plan',
      description: 'Create a basic floor plan with dimensions 10m x 8m including 2 rooms, 1 bathroom, and proper door/window placements. Use layers appropriately.',
      rubricData: {
        criteria: [
          { name: 'Correct Dimensions', points: 20 },
          { name: 'Proper Layer Usage', points: 15 },
          { name: 'Door/Window Placement', points: 20 },
          { name: 'Line Quality', points: 15 },
          { name: 'Overall Accuracy', points: 30 },
        ],
      },
      acceptedFileTypes: ['.dwg', '.dxf'],
      difficulty: 'STANDARD',
      estimatedMinutes: 60,
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  await prisma.practicalTask.create({
    data: {
      assessmentTypeId: pythonAssessment.id,
      type: 'CODING',
      title: 'Build a REST API with Flask',
      description: 'Create a simple REST API using Flask with CRUD operations for a "Book" resource. Include proper error handling and validation.',
      rubricData: {
        criteria: [
          { name: 'API Endpoints Implementation', points: 25 },
          { name: 'Error Handling', points: 20 },
          { name: 'Data Validation', points: 20 },
          { name: 'Code Quality', points: 20 },
          { name: 'Documentation', points: 15 },
        ],
      },
      acceptedFileTypes: ['.py', '.zip'],
      difficulty: 'STANDARD',
      estimatedMinutes: 90,
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  await prisma.practicalTask.create({
    data: {
      assessmentTypeId: reactAssessment.id,
      type: 'CODING',
      title: 'Build a Todo App with React',
      description: 'Create a fully functional Todo application using React with add, edit, delete, and mark complete features. Use React hooks and proper component structure.',
      rubricData: {
        criteria: [
          { name: 'Component Structure', points: 20 },
          { name: 'State Management', points: 25 },
          { name: 'CRUD Functionality', points: 25 },
          { name: 'UI/UX Quality', points: 15 },
          { name: 'Code Quality', points: 15 },
        ],
      },
      acceptedFileTypes: ['.jsx', '.js', '.zip'],
      difficulty: 'STANDARD',
      estimatedMinutes: 120,
      status: 'ACTIVE',
      createdBy: examSetup.id,
    },
  });

  console.log('✅ Practical tasks created');

  // ============================================================================
  // 6. CANDIDATES
  // ============================================================================
  console.log('Creating candidates...');

  const candidates = [
    {
      email: 'ahmed.ali@email.com',
      firstName: 'Ahmed',
      lastName: 'Ali',
      phone: '+971501234567',
      jobPosition: 'CAD Drafter',
      yearsExperience: '3',
      department: 'Engineering',
      organizationId: demoCompanyOrg.id,
    },
    {
      email: 'fatima.hassan@email.com',
      firstName: 'Fatima',
      lastName: 'Hassan',
      phone: '+971502345678',
      jobPosition: 'Python Developer',
      yearsExperience: '5',
      department: 'IT',
      organizationId: demoCompanyOrg.id,
    },
    {
      email: 'mohammed.khan@email.com',
      firstName: 'Mohammed',
      lastName: 'Khan',
      phone: '+971503456789',
      jobPosition: 'Frontend Developer',
      yearsExperience: '4',
      department: 'IT',
      organizationId: demoCompanyOrg.id,
    },
    {
      email: 'sara.ahmed@email.com',
      firstName: 'Sara',
      lastName: 'Ahmed',
      phone: '+971504567890',
      jobPosition: 'CAD Designer',
      yearsExperience: '2',
      department: 'Design',
      organizationId: techCorpOrg.id,
    },
    {
      email: 'omar.ibrahim@email.com',
      firstName: 'Omar',
      lastName: 'Ibrahim',
      phone: '+971505678901',
      jobPosition: 'Full Stack Developer',
      yearsExperience: '6',
      department: 'Development',
      organizationId: techCorpOrg.id,
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidateRecord.upsert({
      where: {
        email_organizationId: {
          email: candidate.email,
          organizationId: candidate.organizationId,
        },
      },
      update: {},
      create: candidate,
    });
  }

  console.log('✅ Candidates created');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - 3 Organizations');
  console.log('  - 8 Users (all roles)');
  console.log('  - 3 Assessment Types');
  console.log('  - 9 MCQ Questions');
  console.log('  - 3 Practical Tasks');
  console.log('  - 5 Candidates');
  console.log('');
  console.log('📋 Demo Credentials:');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ SUPER ADMIN                                                 │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    admin@assessexpert.ae                             │');
  console.log('│ Password: Admin@assessexpert2026!                           │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ MASTER PROCTOR                                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    masterproctor@assessexpert.ae                     │');
  console.log('│ Password: MasterProctor@2026!                               │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ EXAM SETUP MASTER                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    examsetup@assessexpert.ae                         │');
  console.log('│ Password: ExamSetup@2026!                                   │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ PROCTOR                                                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    proctor@assessexpert.ae                           │');
  console.log('│ Password: Proctor@2026!                                     │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ SALES AGENT                                                 │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    sales@assessexpert.ae                             │');
  console.log('│ Password: Sales@2026!                                       │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ HR MANAGER - Demo Company                                   │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    hr@democompany.ae                                 │');
  console.log('│ Password: HRManager@2026!                                   │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ORG ADMIN - Demo Company                                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    admin@democompany.ae                              │');
  console.log('│ Password: OrgAdmin@2026!                                    │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ HR MANAGER - TechCorp                                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Email:    hr@techcorp.ae                                    │');
  console.log('│ Password: TechHR@2026!                                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');
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
