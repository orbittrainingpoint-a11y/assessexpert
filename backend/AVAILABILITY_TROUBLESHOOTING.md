# Proctor Availability - Live Server Troubleshooting Guide

## Issues Reported

1. ✅ **Localhost:** Availability saves successfully
2. ❌ **Live Server:** Availability not saving
3. ❌ **HR Portal:** "No available slots in this range" message

## Root Causes Identified

### 1. Scheduling Service Using Hardcoded Slots
**Problem:** The `getAvailableSlots()` method was generating hardcoded slots (9am-5pm weekdays) instead of reading from the ProctorAvailability table.

**Fixed:** Updated `scheduling.service.ts` to:
- Query ProctorAvailability table
- Generate slots based on actual proctor availability
- Return empty array if no availability set

### 2. Live Server Environment Issues
**Possible causes:**
- Database not synced (missing ProctorAvailability records)
- API endpoint not deployed
- CORS or authentication issues
- Different database between local and live

## Fixes Applied

### Backend Changes

#### 1. Fixed `scheduling.service.ts`
```typescript
async getAvailableSlots(assessmentTypeId: string, dateFrom: string, dateTo: string) {
  // Now reads from ProctorAvailability table
  const availabilitySlots = await this.prisma.proctorAvailability.findMany({
    where: {
      proctorId: { in: proctorIds },
      isOverride: false,
    },
  });
  
  // Generates slots based on actual availability
  // Returns empty array if no availability found
}
```

#### 2. Added Diagnostics Endpoint
```
GET /api/scheduling/diagnostics
```

Returns:
- Total active proctors
- Proctors with availability set
- Proctors without availability
- All availability slots
- Detailed breakdown per proctor

## Testing Steps

### Step 1: Test Localhost

1. **Set Proctor Availability:**
   ```
   Login: proctor@assessexpert.ae
   Go to: Settings → Availability
   Click slots to mark available
   Click "Save Availability"
   ```

2. **Check Database:**
   ```sql
   SELECT * FROM "ProctorAvailability" WHERE "proctorId" = 'YOUR_PROCTOR_ID';
   ```

3. **Test HR Scheduling:**
   ```
   Login as HR Manager
   Go to: Candidates
   Click "Schedule" on a candidate
   Select assessment and date range
   Click "Check Available Slots"
   ```

### Step 2: Run Diagnostics (Localhost)

```bash
curl -X GET http://localhost:4000/api/scheduling/diagnostics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "summary": {
    "totalProctors": 1,
    "proctorsWithAvailability": 1,
    "proctorsWithoutAvailability": 0,
    "totalAvailabilitySlots": 15
  },
  "proctors": [
    {
      "id": "clxxx...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "proctor@assessexpert.ae",
      "timezone": "Asia/Dubai",
      "maxSessionsPerDay": 4,
      "slotsCount": 15,
      "slots": [...]
    }
  ]
}
```

### Step 3: Deploy to Live Server

```bash
# 1. Commit changes
git add .
git commit -m "Fix: Scheduling service now uses ProctorAvailability table"
git push origin main

# 2. Deploy backend
cd backend
npm run build
pm2 restart assessexpert-backend

# 3. Check logs
pm2 logs assessexpert-backend
```

### Step 4: Test Live Server

1. **Run Diagnostics:**
   ```bash
   curl -X GET https://assessexpert.com/api/scheduling/diagnostics \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Check Response:**
   - If `totalProctors: 0` → No proctors in database
   - If `proctorsWithAvailability: 0` → Proctors haven't set availability
   - If `totalAvailabilitySlots: 0` → No availability data

3. **Set Availability on Live:**
   ```
   Login: proctor@assessexpert.ae (on live server)
   Go to: Settings → Availability
   Set availability slots
   Save
   ```

4. **Verify in Database:**
   ```sql
   -- Connect to live database
   SELECT COUNT(*) FROM "ProctorAvailability";
   SELECT * FROM "ProctorAvailability" LIMIT 10;
   ```

## Common Issues & Solutions

### Issue 1: "No available slots" on Live Server

**Diagnosis:**
```bash
curl https://assessexpert.com/api/scheduling/diagnostics \
  -H "Authorization: Bearer TOKEN"
```

**If `proctorsWithAvailability: 0`:**
- Proctors need to set their availability on live server
- Availability data is NOT synced between local and live
- Each environment has its own database

**Solution:**
1. Login to live server as proctor
2. Go to Settings → Availability
3. Set availability slots
4. Save

### Issue 2: Availability Saves but Doesn't Show

**Check Backend Logs:**
```bash
pm2 logs assessexpert-backend --lines 100
```

**Look for:**
```
[UsersService] Saving availability for proctor: clxxx...
[UsersService] Created X new slots
[SchedulingService] Found X availability slots in database
```

**If no logs:**
- API endpoint not being called
- Check browser DevTools → Network tab
- Verify API URL in frontend

**If logs show 0 slots:**
- Data not saving to database
- Check database connection
- Verify Prisma schema is synced

### Issue 3: Different Behavior Local vs Live

**Possible Causes:**

1. **Different Databases:**
   - Local: `localhost:5432/assessexpert`
   - Live: Different database server
   - Solution: Set availability on both

2. **Code Not Deployed:**
   - Check git commit hash on live server
   - Verify latest code is deployed
   - Restart backend after deployment

3. **Environment Variables:**
   - Check `DATABASE_URL` on live server
   - Verify it points to correct database

4. **Prisma Schema Not Synced:**
   ```bash
   # On live server
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   pm2 restart assessexpert-backend
   ```

## Verification Checklist

### Localhost:
- [ ] Proctor can set availability
- [ ] Availability saves to database
- [ ] Diagnostics shows availability data
- [ ] HR can see available slots
- [ ] Slots match proctor availability

### Live Server:
- [ ] Latest code deployed
- [ ] Backend restarted
- [ ] Proctor can access settings page
- [ ] Proctor can set availability
- [ ] Availability saves (check logs)
- [ ] Diagnostics shows availability data
- [ ] HR can see available slots
- [ ] Slots match proctor availability

## API Endpoints Reference

### Save Availability
```
POST /api/users/:proctorId/availability
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "slots": [
    {
      "dayOfWeek": 0,
      "startTime": "08:00",
      "endTime": "12:00"
    }
  ],
  "timezone": "Asia/Dubai",
  "maxSessionsPerDay": 4
}
```

### Get Availability
```
GET /api/users/:proctorId/availability
Authorization: Bearer TOKEN
```

### Get Available Slots (HR)
```
GET /api/scheduling/slots?assessmentTypeId=xxx&dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer TOKEN
```

### Diagnostics
```
GET /api/scheduling/diagnostics
Authorization: Bearer TOKEN
```

## Database Queries

### Check Proctor Availability
```sql
-- Count total slots
SELECT COUNT(*) FROM "ProctorAvailability";

-- View all slots
SELECT 
  pa.*,
  u."firstName",
  u."lastName",
  u."email"
FROM "ProctorAvailability" pa
JOIN "User" u ON u.id = pa."proctorId"
ORDER BY pa."proctorId", pa."dayOfWeek", pa."startTime";

-- Check specific proctor
SELECT * FROM "ProctorAvailability" 
WHERE "proctorId" = 'YOUR_PROCTOR_ID';

-- Find proctors without availability
SELECT 
  u.id,
  u."firstName",
  u."lastName",
  u.email,
  COUNT(pa.id) as slot_count
FROM "User" u
LEFT JOIN "ProctorAvailability" pa ON pa."proctorId" = u.id
WHERE u.role = 'PROCTOR' AND u.status = 'ACTIVE'
GROUP BY u.id, u."firstName", u."lastName", u.email
HAVING COUNT(pa.id) = 0;
```

## Logs to Monitor

### Backend Logs
```bash
# Real-time logs
pm2 logs assessexpert-backend

# Last 100 lines
pm2 logs assessexpert-backend --lines 100

# Filter for availability
pm2 logs assessexpert-backend | grep -i availability
```

### Look for These Messages:

**Saving Availability:**
```
[UsersService] Saving availability for proctor: clxxx...
[UsersService] Received 8 slots
[UsersService] Deleted 5 existing slots
[UsersService] Created 8 new slots
[UsersService] Availability saved successfully
```

**Getting Slots:**
```
[SchedulingService] Getting available slots from 2024-01-01 to 2024-01-31
[SchedulingService] Found 2 active proctors
[SchedulingService] Found 15 availability slots in database
[SchedulingService] Generated 45 available slots
```

**No Availability:**
```
[SchedulingService] Found 0 availability slots in database
[SchedulingService] No availability slots found. Proctors need to set availability.
```

## Quick Fix Commands

### Restart Backend
```bash
pm2 restart assessexpert-backend
pm2 logs assessexpert-backend
```

### Sync Database Schema
```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

### Check Database Connection
```bash
cd backend
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Test API Directly
```bash
# Get diagnostics
curl https://assessexpert.com/api/scheduling/diagnostics \
  -H "Authorization: Bearer TOKEN" | jq

# Get slots
curl "https://assessexpert.com/api/scheduling/slots?assessmentTypeId=xxx&dateFrom=2024-01-01&dateTo=2024-01-31" \
  -H "Authorization: Bearer TOKEN" | jq
```

## Summary

### What Was Fixed:
1. ✅ Scheduling service now reads from ProctorAvailability table
2. ✅ Added comprehensive logging
3. ✅ Added diagnostics endpoint
4. ✅ Returns empty array if no availability (instead of hardcoded slots)

### What Needs to Be Done:
1. ⏭️ Deploy to live server
2. ⏭️ Restart backend
3. ⏭️ Set proctor availability on live server
4. ⏭️ Test HR scheduling flow
5. ⏭️ Monitor logs for errors

### Expected Behavior:
- Proctor sets availability → Saves to database
- HR checks slots → Reads from database
- If no availability set → Shows "No available slots"
- If availability set → Shows matching slots

The system now correctly uses the ProctorAvailability table instead of hardcoded values!
