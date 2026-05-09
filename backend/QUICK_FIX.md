# Quick Fix Guide - Add Candidate 500 Error

## Issue Summary
- **Error 1:** POST /api/candidates returns 500 Internal Server Error
- **Error 2:** GET /api/sessions returns 403 Forbidden

## Immediate Steps to Fix

### Step 1: Install Dependencies (if needed)
```bash
cd "d:\Assess Expert New\assessexpert\backend"
npm install
```

### Step 2: Run Diagnostics
```bash
npm run diagnostics
```

This will show you exactly what's wrong with your configuration.

### Step 3: Fix SMTP Configuration

**The main issue is likely your Gmail App Password.**

1. Open your `.env` file: `d:\Assess Expert New\assessexpert\backend\.env`

2. Update SMTP_PASS with a Gmail App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Sign in with: theassessexpert@gmail.com
   - Create new App Password for "Mail" on "Windows Computer"
   - Copy the 16-character password (remove spaces)
   - Update in .env:

```env
SMTP_PASS=abcdabcdabcdabcd
```

3. Also update JWT secrets (generate random 32+ character strings):

```env
JWT_SECRET=your-random-secret-min-32-characters-here
JWT_REFRESH_SECRET=your-random-refresh-secret-min-32-characters-here
```

### Step 4: Test SMTP
```bash
npm run test:smtp
```

This will verify your email configuration is working.

### Step 5: Restart Backend
```bash
npm run start:dev
```

### Step 6: Test Add Candidate

Open your HR portal and try adding a candidate. The backend will now show detailed error logs.

## What Was Fixed

### 1. Candidates Service
- ✅ Added validation for required fields
- ✅ Added default value for jobPosition
- ✅ Added comprehensive error logging
- ✅ Better error messages

### 2. Global Error Handler
- ✅ Created AllExceptionsFilter for detailed error reporting
- ✅ All errors now logged with full stack traces
- ✅ Better error responses to frontend

### 3. Diagnostic Tools
- ✅ `npm run diagnostics` - Check all configurations
- ✅ `npm run test:smtp` - Test email configuration

## Understanding the 403 Error

The `/api/sessions` endpoint requires specific roles:
- `SUPER_ADMIN` or `MASTER_PROCTOR`

If you're logged in as `HR_MANAGER`, you'll get 403 Forbidden. This is expected behavior.

HR Managers should use:
- `/api/candidates` - Manage candidates ✅
- `/api/sessions?organizationId=xxx` - View their org's sessions (if implemented)

## Checking Backend Logs

After restarting, watch the console for detailed logs:

```
[CandidatesService] Creating candidate with data: {...}
[CandidatesService] Candidate created successfully: clxxx...
```

Or errors:
```
[CandidatesService] Error creating candidate: jobPosition is required
[AllExceptionsFilter] POST /api/candidates - Status: 400 - Message: jobPosition is required
```

## Common Issues & Solutions

### "Email is required"
**Frontend is not sending email field**
- Check the form in HR portal
- Ensure email input has correct name attribute

### "Candidate with this email already exists"
**Duplicate email in same organization**
- Use different email
- Or delete existing candidate first

### "Authentication required"
**JWT token expired or invalid**
- Log out and log back in
- Check browser cookies

### Database connection failed
**PostgreSQL not running**
```bash
# Start PostgreSQL (Windows)
net start postgresql-x64-14

# Or check services
services.msc
```

## Next Steps

1. ✅ Run `npm run diagnostics`
2. ✅ Fix SMTP_PASS in .env
3. ✅ Run `npm run test:smtp`
4. ✅ Restart backend: `npm run start:dev`
5. ✅ Try adding candidate
6. ✅ Check console logs for detailed errors

## Need More Help?

Check the full troubleshooting guide:
- `TROUBLESHOOTING.md` - Complete guide with all details

Or check backend console logs for specific error messages.
