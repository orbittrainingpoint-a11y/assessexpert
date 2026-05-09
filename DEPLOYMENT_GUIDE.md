# Deployment Guide - Session Management Fixes

## What Was Fixed

### 1. Email Time Format ✅
- **Before**: `Thu Jan 15 2024 14:30:00 GMT+0400 (Gulf Standard Time)`
- **After**: `Monday, January 15, 2024 at 02:30 PM (Asia/Dubai)`
- **Impact**: Candidates receive clear, readable date/time in invitation emails

### 2. Join Session Button ✅
- **Before**: Button only showed for "today's" sessions
- **After**: Button shows 15 minutes before scheduled time
- **Impact**: Proctors can join sessions at the right time

### 3. 15-Minute Window Validation ✅
- **Before**: Candidates could join at any time
- **After**: Can only join 15 minutes before to 15 minutes after scheduled time
- **Impact**: Enforces proper session timing, prevents early/late access

### 4. All Sessions Page ✅
- **Before**: No way to see all scheduled sessions
- **After**: New page with Upcoming/Past/All tabs
- **Impact**: Proctors can see their full schedule

---

## Files Changed (Total: 7 files)

### Backend (5 files)
1. `backend/src/modules/notifications/notifications.service.ts`
   - Fixed email date/time formatting
   - Added 15-minute notice in email

2. `backend/src/modules/scheduling/scheduling.service.ts`
   - Changed token expiry to 15 minutes after scheduled time
   - Fixed reminder email formatting

3. `backend/src/modules/exam-delivery/exam-delivery.service.ts`
   - Added 15-minute window validation

4. `backend/src/modules/sessions/sessions.controller.ts`
   - Added PROCTOR role access to getAllSessions

5. `backend/src/modules/sessions/sessions.service.ts`
   - Updated return format for consistency

### Frontend (2 files)
1. `frontend/portal/app/(portal)/layout.tsx`
   - Added "All Sessions" to proctor sidebar

2. `frontend/portal/app/(portal)/proctor/sessions/page.tsx` (NEW)
   - Created sessions page with tabs
   - Added join button logic

---

## Testing Before Deployment

### Local Testing (Recommended)
```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend/portal
npm run dev

# Open browser
http://localhost:3000
```

### Test Scenarios
1. **Email Format**
   - Login as HR Manager
   - Schedule a session for a candidate
   - Check email received by candidate
   - Verify date format is readable

2. **Join Button**
   - Login as Proctor
   - Go to "All Sessions"
   - Schedule a session for 20 minutes from now
   - Verify button doesn't show yet
   - Wait until 15 minutes before
   - Refresh and verify button appears

3. **15-Minute Window**
   - As candidate, try to join 20 minutes early → Should fail
   - Try to join 10 minutes early → Should work
   - Try to join 20 minutes late → Should fail

---

## Deployment to Live Server

### Option 1: Automated Script (Recommended)
```bash
# SSH into server
ssh root@assessexpert.com

# Navigate to project
cd /var/www/html/assessexpert

# Make script executable
chmod +x deploy-live.sh

# Run deployment
sudo ./deploy-live.sh
```

### Option 2: Manual Deployment
```bash
# SSH into server
ssh root@assessexpert.com

# Pull latest code
cd /var/www/html/assessexpert
git pull origin main

# Update backend
cd backend
npm install
npx prisma generate
pm2 restart assessexpert-backend

# Update frontend
cd ../frontend/portal
npm install
npm run build
pm2 restart assessexpert-frontend

# Check status
pm2 status
```

---

## Verification After Deployment

### 1. Check Services Running
```bash
pm2 status
```
Expected output:
```
┌─────┬────────────────────────┬─────────┬─────────┐
│ id  │ name                   │ status  │ restart │
├─────┼────────────────────────┼─────────┼─────────┤
│ 0   │ assessexpert-backend   │ online  │ 0       │
│ 1   │ assessexpert-frontend  │ online  │ 0       │
└─────┴────────────────────────┴─────────┴─────────┘
```

### 2. Check Backend Logs
```bash
pm2 logs assessexpert-backend --lines 50
```
Look for:
- No errors
- "Nest application successfully started"

### 3. Check Frontend Logs
```bash
pm2 logs assessexpert-frontend --lines 50
```
Look for:
- No build errors
- Server running on port 3005

### 4. Test Live Site
1. Open https://assessexpert.com
2. Login as HR Manager
3. Schedule a test session
4. Check candidate email
5. Login as Proctor
6. Go to "All Sessions"
7. Verify session appears

---

## Rollback Plan

If something goes wrong:

```bash
# Find previous commit
cd /var/www/html/assessexpert
git log --oneline -5

# Rollback to previous commit (replace COMMIT_HASH)
git checkout <COMMIT_HASH>

# Rebuild and restart
cd backend && pm2 restart assessexpert-backend
cd ../frontend/portal && npm run build && pm2 restart assessexpert-frontend
```

Previous stable commits:
- `1f4d723` - Before session fixes
- `b79353b` - All Sessions page added
- `120b285` - Availability fixes

---

## Monitoring

### Check Logs Continuously
```bash
# Backend logs
pm2 logs assessexpert-backend

# Frontend logs
pm2 logs assessexpert-frontend

# Both together
pm2 logs
```

### Check Disk Space
```bash
df -h
```

### Check Memory Usage
```bash
free -h
pm2 monit
```

---

## Support Contacts

- **Developer**: [Your contact]
- **Server**: root@assessexpert.com
- **Database**: PostgreSQL on localhost:5432
- **PM2 Process Manager**: `pm2 status`

---

## Git Commits

All changes pushed to GitHub:
- `059ca6a` - Add deployment script
- `1f4d723` - Update README with fixes
- `e3892c5` - Fix email time format, join button, 15-minute window
- `b79353b` - Add All Sessions page for proctors

---

## Next Steps After Deployment

1. Monitor logs for 30 minutes
2. Test with real candidate email
3. Verify proctor can see and join sessions
4. Check email formatting in inbox
5. Test 15-minute window with test candidate

---

## Common Issues & Solutions

### Issue: Backend won't start
```bash
# Check logs
pm2 logs assessexpert-backend --err

# Check if port 4000 is in use
lsof -i :4000

# Restart
pm2 restart assessexpert-backend
```

### Issue: Frontend build fails
```bash
# Clear cache
cd /var/www/html/assessexpert/frontend/portal
rm -rf .next
npm run build
```

### Issue: Database connection error
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Check connection
psql -U assessexpert -d assessexpert -h localhost
```

### Issue: Email not sending
```bash
# Check SMTP settings in .env
cat /var/www/html/assessexpert/backend/.env | grep SMTP

# Test SMTP connection
npm run test:smtp
```

---

**Deployment Date**: [To be filled]
**Deployed By**: [To be filled]
**Status**: Ready for deployment
