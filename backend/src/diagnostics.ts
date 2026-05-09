import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function runDiagnostics() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       AssessExpert Backend Diagnostics                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Environment Variables Check
  console.log('📋 1. Environment Variables:');
  console.log('─────────────────────────────────────────────────────────────');
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'FRONTEND_URL',
    'PORT',
  ];

  let envIssues = 0;
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.includes('your-') || value.includes('change-in-production')) {
      console.log(`❌ ${varName}: NOT CONFIGURED`);
      envIssues++;
    } else {
      const displayValue = varName.includes('SECRET') || varName.includes('PASS') || varName.includes('URL')
        ? '***' + value.slice(-4)
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  });
  console.log(`\nEnvironment Status: ${envIssues === 0 ? '✅ All configured' : `❌ ${envIssues} issues found`}\n`);

  // 2. Database Connection Check
  console.log('🗄️  2. Database Connection:');
  console.log('─────────────────────────────────────────────────────────────');
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    const orgCount = await prisma.organization.count();
    const userCount = await prisma.user.count();
    const candidateCount = await prisma.candidateRecord.count();
    
    console.log(`✅ Organizations: ${orgCount}`);
    console.log(`✅ Users: ${userCount}`);
    console.log(`✅ Candidates: ${candidateCount}`);
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
  }
  console.log();

  // 3. Check for test organization and user
  console.log('👤 3. Test Data Check:');
  console.log('─────────────────────────────────────────────────────────────');
  try {
    const testOrg = await prisma.organization.findFirst();
    if (testOrg) {
      console.log(`✅ Organization found: ${testOrg.name} (${testOrg.id})`);
      
      const testUser = await prisma.user.findFirst({
        where: { organizationId: testOrg.id, role: 'HR_MANAGER' }
      });
      
      if (testUser) {
        console.log(`✅ HR Manager found: ${testUser.email}`);
      } else {
        console.log('⚠️  No HR Manager found in organization');
      }
    } else {
      console.log('⚠️  No organizations found in database');
    }
  } catch (error) {
    console.log('❌ Error checking test data:', error.message);
  }
  console.log();

  // 4. SMTP Configuration
  console.log('📧 4. SMTP Configuration:');
  console.log('─────────────────────────────────────────────────────────────');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpUser || smtpUser.includes('your-')) {
    console.log('❌ SMTP_USER not configured');
  } else {
    console.log(`✅ SMTP_USER: ${smtpUser}`);
  }
  
  if (!smtpPass || smtpPass.includes('your-')) {
    console.log('❌ SMTP_PASS not configured (Gmail App Password required)');
    console.log('   Generate at: https://myaccount.google.com/apppasswords');
  } else {
    console.log(`✅ SMTP_PASS: ***${smtpPass.slice(-4)}`);
  }
  console.log();

  // 5. File Storage Paths
  console.log('📁 5. Storage Configuration:');
  console.log('─────────────────────────────────────────────────────────────');
  const storagePaths = [
    'STORAGE_PATH',
    'RECORDINGS_PATH',
    'REPORTS_PATH',
    'PRACTICAL_FILES_PATH',
  ];
  
  storagePaths.forEach(pathVar => {
    const value = process.env[pathVar];
    console.log(`${value ? '✅' : '⚠️ '} ${pathVar}: ${value || 'Not set'}`);
  });
  console.log();

  // 6. Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Diagnostic Summary                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  if (envIssues > 0) {
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('1. Update .env file with proper configuration');
    console.log('2. Set Gmail App Password for SMTP_PASS');
    console.log('3. Restart the backend server\n');
  } else {
    console.log('\n✅ All configurations look good!\n');
  }

  await prisma.$disconnect();
}

runDiagnostics().catch(console.error);
