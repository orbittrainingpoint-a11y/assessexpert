# JWT Secrets - Setup Complete ✅

> **⚠️ SECURITY NOTICE (2026-05-25):** earlier revisions of this file
> contained the literal JWT_SECRET / JWT_REFRESH_SECRET values used in
> production. They've been redacted here, **but they remain in git
> history** — you must treat them as compromised and rotate.
>
> Rotate on the live server:
> ```bash
> cd /var/www/html/assessexpert/backend
> node generate-secrets.js          # prints two new base64 values
> # paste both into backend/.env, replacing JWT_SECRET + JWT_REFRESH_SECRET
> pm2 reload assessexpert-backend --update-env
> ```
> All issued JWTs (access + refresh) will be invalidated. Users will need
> to sign in again — expected. Never paste these values into any doc again.

## What Was Done

Your `.env` file has been updated with **cryptographically secure JWT secrets**.

### Generated Secrets:

```env
JWT_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
JWT_REFRESH_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
```

### Security Details:

- ✅ **256-bit** cryptographically secure random values
- ✅ **Base64 encoded** (44 characters each)
- ✅ **Unique** - Never used before
- ✅ **Production-ready** - Safe for production use
- ✅ **Automatically generated** using Node.js crypto module

---

## How It Works

### JWT_SECRET
Used to sign and verify access tokens (short-lived, 15 minutes)

### JWT_REFRESH_SECRET
Used to sign and verify refresh tokens (long-lived, 7 days)

### Token Expiration
- Access Token: 15 minutes (`JWT_EXPIRES_IN=15m`)
- Refresh Token: 7 days (`JWT_REFRESH_EXPIRES_IN=7d`)

---

## Regenerate Secrets (If Needed)

If you ever need to generate new secrets:

```bash
# Method 1: Using npm script
npm run generate:secrets

# Method 2: Direct execution
node generate-secrets.js
```

Then manually copy the output to your `.env` file.

---

## Security Best Practices

### ✅ DO:
- Keep secrets in `.env` file (already in `.gitignore`)
- Use different secrets for development and production
- Rotate secrets periodically (every 3-6 months)
- Use strong, random secrets (like these generated ones)

### ❌ DON'T:
- Commit secrets to version control
- Share secrets in chat/email
- Use simple/predictable secrets
- Reuse secrets across environments

---

## Production Deployment

When deploying to production:

1. **Generate new secrets** for production:
   ```bash
   npm run generate:secrets
   ```

2. **Set environment variables** on your production server:
   ```bash
   # Linux/Mac
   export JWT_SECRET="your-production-secret"
   export JWT_REFRESH_SECRET="your-production-refresh-secret"
   
   # Windows
   set JWT_SECRET=your-production-secret
   set JWT_REFRESH_SECRET=your-production-refresh-secret
   ```

3. **Or use your hosting platform's environment variable settings:**
   - AWS: Systems Manager Parameter Store / Secrets Manager
   - Heroku: Config Vars
   - Vercel: Environment Variables
   - Docker: Docker secrets or environment files

---

## Troubleshooting

### Issue: "Invalid token" errors after changing secrets
**Cause:** All existing tokens become invalid when secrets change
**Solution:** Users need to log in again to get new tokens

### Issue: "Token expired"
**Cause:** Access token expired after 15 minutes
**Solution:** Frontend should use refresh token to get new access token

### Issue: "jwt malformed"
**Cause:** Invalid or corrupted token
**Solution:** Clear cookies/localStorage and log in again

---

## Current Configuration

Your `.env` file now has:

```env
# JWT - Secure secrets generated on 2024
JWT_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
JWT_REFRESH_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## Testing JWT Authentication

After starting the backend, test authentication:

### 1. Login Request
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx...",
    "email": "user@example.com",
    "role": "HR_MANAGER"
  }
}
```

### 2. Protected Request
```bash
curl -X GET http://localhost:4000/api/candidates \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## What Changed in Your Files

### 1. `.env` (UPDATED)
```diff
- JWT_SECRET=assessexpert-jwt-secret-change-in-production-min-32-chars
- JWT_REFRESH_SECRET=assessexpert-refresh-secret-change-in-production-min-32-chars
+ JWT_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
+ JWT_REFRESH_SECRET=REDACTED-ROTATE-ON-LIVE-SERVER
```

### 2. `generate-secrets.js` (NEW)
- Script to generate secure random secrets
- Uses Node.js crypto module
- Can be run anytime: `npm run generate:secrets`

### 3. `package.json` (UPDATED)
- Added script: `"generate:secrets": "node generate-secrets.js"`

---

## Next Steps

1. ✅ JWT secrets are now configured
2. ✅ Secrets are cryptographically secure
3. ⏭️ Continue with SMTP configuration (if not done)
4. ⏭️ Run diagnostics: `npm run diagnostics`
5. ⏭️ Start backend: `npm run start:dev`
6. ⏭️ Test authentication and add candidate

---

## Summary

✅ **JWT_SECRET** - Secure 256-bit secret generated
✅ **JWT_REFRESH_SECRET** - Secure 256-bit secret generated
✅ **.env file** - Updated with new secrets
✅ **Generator script** - Available for future use
✅ **Production-ready** - Safe for production deployment

Your JWT authentication is now properly configured with secure secrets! 🔐

---

**Generated:** 2024
**Status:** ✅ Complete
**Next:** Configure SMTP (see README_FIXES.md)
