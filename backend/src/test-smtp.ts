import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testSMTP() {
  console.log('=== SMTP Configuration Test ===\n');
  
  console.log('Configuration:');
  console.log(`SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NOT SET'}`);
  console.log(`SMTP_FROM: ${process.env.SMTP_FROM}\n`);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ ERROR: SMTP_USER or SMTP_PASS not configured in .env file');
    console.log('\nPlease update your .env file with valid Gmail App Password:');
    console.log('1. Go to https://myaccount.google.com/apppasswords');
    console.log('2. Generate a new App Password');
    console.log('3. Update SMTP_PASS in .env file');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'AssessExpert SMTP Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #00D4FF;">✅ SMTP Configuration Test Successful</h2>
          <p>Your AssessExpert email configuration is working correctly!</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}\n`);
    console.log('=== Test Complete ===');
  } catch (error) {
    console.error('❌ SMTP Test Failed:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n⚠️  Authentication failed. Please check:');
      console.log('1. SMTP_USER is correct');
      console.log('2. SMTP_PASS is a valid Gmail App Password (not your regular password)');
      console.log('3. Generate App Password at: https://myaccount.google.com/apppasswords');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️  Connection refused. Please check:');
      console.log('1. SMTP_HOST and SMTP_PORT are correct');
      console.log('2. Your firewall allows outbound connections on port 587');
    }
  }
}

testSMTP();
