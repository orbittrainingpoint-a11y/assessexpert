const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create Users
  console.log('Creating users...');

  // Super Admin
  await prisma.user.upsert({
    where: { email: 'admin@assessexpert.ae' },
    update: {},
    create: {
      email: 'admin@assessexpert.ae',
      passwordHash: await bcrypt.hash('Admin@assessexpert2026!', 10),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // Master Proctor
  await prisma.user.upsert({
    where: { email: 'masterproctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'masterproctor@assessexpert.ae',
      passwordHash: await bcrypt.hash('MasterProctor@2026!', 10),
      firstName: 'Master',
      lastName: 'Proctor',
      role: 'MASTER_PROCTOR',
    },
  });

  // Exam Setup
  await prisma.user.upsert({
    where: { email: 'examsetup@assessexpert.ae' },
    update: {},
    create: {
      email: 'examsetup@assessexpert.ae',
      passwordHash: await bcrypt.hash('ExamSetup@2026!', 10),
      firstName: 'Exam',
      lastName: 'Setup',
      role: 'ORG_ADMIN',
    },
  });

  // Proctor
  await prisma.user.upsert({
    where: { email: 'proctor@assessexpert.ae' },
    update: {},
    create: {
      email: 'proctor@assessexpert.ae',
      passwordHash: await bcrypt.hash('Proctor@2026!', 10),
      firstName: 'John',
      lastName: 'Proctor',
      role: 'PROCTOR',
    },
  });

  // Sales
  await prisma.user.upsert({
    where: { email: 'sales@assessexpert.ae' },
    update: {},
    create: {
      email: 'sales@assessexpert.ae',
      passwordHash: await bcrypt.hash('Sales@2026!', 10),
      firstName: 'Sales',
      lastName: 'Manager',
      role: 'ORG_ADMIN',
    },
  });

  // HR Manager
  await prisma.user.upsert({
    where: { email: 'hr@democompany.ae' },
    update: {},
    create: {
      email: 'hr@democompany.ae',
      passwordHash: await bcrypt.hash('HRManager@2026!', 10),
      firstName: 'HR',
      lastName: 'Manager',
      role: 'HR_MANAGER',
    },
  });

  console.log('✅ Users created');
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
