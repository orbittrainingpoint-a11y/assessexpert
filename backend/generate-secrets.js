const crypto = require('crypto');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       JWT Secret Generator for AssessExpert                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Generate secure random secrets
const jwtSecret = crypto.randomBytes(32).toString('base64');
const jwtRefreshSecret = crypto.randomBytes(32).toString('base64');

console.log('✅ Generated Secure JWT Secrets:\n');
console.log('Copy these to your .env file:\n');
console.log('─────────────────────────────────────────────────────────────');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log('─────────────────────────────────────────────────────────────\n');

console.log('📋 Full .env configuration:\n');
console.log('# JWT Configuration (Generated ' + new Date().toISOString() + ')');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log('JWT_EXPIRES_IN=15m');
console.log('JWT_REFRESH_EXPIRES_IN=7d\n');

console.log('💡 These secrets are:');
console.log('   - 256-bit cryptographically secure random values');
console.log('   - Base64 encoded (44 characters each)');
console.log('   - Unique and never used before');
console.log('   - Safe for production use\n');

console.log('⚠️  IMPORTANT:');
console.log('   - Keep these secrets private');
console.log('   - Never commit them to version control');
console.log('   - Use different secrets for production\n');
