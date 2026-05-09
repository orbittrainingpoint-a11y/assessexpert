# AssessExpert Backend - Troubleshooting Guide

## Current Issues

### 1. 500 Internal Server Error - Add Candidate
**Error:** `POST /api/candidates` returns 500 Internal Server Error

**Root Cause:** Missing or invalid required fields when creating candidates

**Solution Applied:**
- Added comprehensive validation for required fields (email, firstName, lastName, jobPosition)
- Added detailed error logging to identify exact issues
- Added global exception filter for better error reporting

### 2. 403 Forbidden - Sessions API
**Error:** `GET /api/sessions` returns 403 Forbidden

**Root Cause:** User role doesn't have permission to access sessions endpoint

**Roles Required:**
- `/api/sessions` - Requires `SUPER_ADMIN` or `MASTER_PROCTOR` role
- `/api/candidates` - Requires `HR_MANAGER`, `ORG_ADMIN`, or `SUPER_ADMIN` role

---

## Quick Diagnostics

### Step 1: Run Diagnostics Script
```bash
cd d:\Assess Expert New\assessexpert\backend
npx ts-node src/diagnostics.ts
```

This will check:
- ✅ Environment variables configuration
- ✅ Database connection
- ✅ Test data (organizations, users)
- ✅ SMTP configuration
- ✅ Storage paths

### Step 2: Test SMTP Configuration
```bash
npx ts-node src/test-smtp.ts
```

This will:
- Verify SMTP connection
- Send a test email
- Identify authentication issues

---

## Configuration Checklist

### 1. Database Configuration
```env
DATABASE_URL="postgresql://assessexpert_app:assessexpert_pass@localhost:5432/assessexpert?schema=public"
```

**Verify:**
```bash
# Test PostgreSQL connection
psql -U assessexpert_app -d assessexpert -h localhost
```

### 2. SMTP Configuration (Gmail)

**Current Issue:** SMTP_PASS needs to be a Gmail App Password

**Steps to Fix:**

1. Go to Google Account: https://myaccount.google.com/apppasswords
2. Sign in with your Gmail account (theassessexpert@gmail.com)
3. Create a new App Password:
   - App: Mail
   - Device: Windows Computer
4. Copy the 16-character password
5. Update `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=theassessexpert@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Replace with your App Password
SMTP_FROM=theassessexpert@gmail.com
```

**Note:** Remove spaces from the App Password when pasting into .env

### 3. JWT Secrets

Update these with strong random strings (minimum 32 characters):

```env
JWT_SECRET=your-strong-secret-here-min-32-chars
JWT_REFRESH_SECRET=your-strong-refresh-secret-here-min-32-chars
```

**Generate secure secrets:**
```bash
# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## Common Errors & Solutions

### Error: "Candidate with this email already exists"
**Status:** 409 Conflict
**Solution:** Email must be unique per organization. Use a different email or delete the existing candidate.

### Error: "Authentication required" / 403 Forbidden
**Cause:** Invalid or expired JWT token, or insufficient role permissions
**Solution:** 
1. Check if user is logged in
2. Verify user role has required permissions
3. Check JWT token in browser DevTools > Application > Cookies

### Error: "Email send failed"
**Cause:** Invalid SMTP credentials
**Solution:** 
1. Run `npx ts-node src/test-smtp.ts`
2. Update SMTP_PASS with Gmail App Password
3. Ensure 2FA is enabled on Gmail account

### Error: Database connection failed
**Cause:** PostgreSQL not running or wrong credentials
**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL service (Windows)
net start postgresql-x64-14

# Verify database exists
psql -U postgres -c "\l" | findstr assessexpert
```

---

## Testing the Fix

### 1. Restart Backend Server
```bash
cd d:\Assess Expert New\assessexpert\backend
npm run start:dev
```

### 2. Test Add Candidate API

**Using curl:**
```bash
curl -X POST http://localhost:4000/api/candidates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d "{
    \"email\": \"test@example.com\",
    \"firstName\": \"John\",
    \"lastName\": \"Doe\",
    \"jobPosition\": \"Software Engineer\",
    \"phone\": \"+971501234567\"
  }"
```

**Expected Response:**
```json
{
  "id": "clxxx...",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "jobPosition": "Software Engineer",
  "organizationId": "...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 3. Check Backend Logs

Look for detailed error messages:
```
[CandidatesService] Creating candidate with data: {...}
[CandidatesService] Candidate created successfully: clxxx...
```

Or error logs:
```
[CandidatesService] Error creating candidate: ...
[AllExceptionsFilter] POST /api/candidates - Status: 500 - Message: ...
```

---

## Next Steps

1. ✅ Run diagnostics: `npx ts-node src/diagnostics.ts`
2. ✅ Fix SMTP configuration with Gmail App Password
3. ✅ Update JWT secrets in .env
4. ✅ Restart backend server
5. ✅ Test add candidate functionality
6. ✅ Check backend console for detailed error logs

---

## Support

If issues persist, check:
- Backend console logs for detailed error messages
- Browser DevTools > Network tab for API responses
- Database logs: Check PostgreSQL logs for constraint violations

**Log Locations:**
- Backend: Console output where `npm run start:dev` is running
- Database: Check PostgreSQL data directory logs
- Frontend: Browser DevTools > Console

---

## Files Modified

1. `src/modules/candidates/candidates.service.ts` - Added validation and logging
2. `src/common/filters/http-exception.filter.ts` - New global exception filter
3. `src/main.ts` - Added global exception filter
4. `src/diagnostics.ts` - New diagnostic script
5. `src/test-smtp.ts` - New SMTP test script
