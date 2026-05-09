# Live Server Availability Not Saving - Debug Guide

## Issue
- ✅ **Localhost:** Availability saves and persists
- ❌ **Live (assessexpert.com):** Availability appears to save but disappears on refresh

## Root Causes

### 1. Environment Variable Mismatch
**Problem:** Frontend might be using wrong API URL on live server

**Check:**
```javascript
// In browser console on assessexpert.com
console.log(process.env.NEXT_PUBLIC_API_URL)
```

**Expected:** `https://assessexpert.com/api`
**If wrong:** Frontend is using localhost URL or undefined

### 2. CORS Issues
**Problem:** Browser blocking API calls from frontend to backend

**Check:** Browser DevTools → Console → Look for CORS errors

### 3. Authentication Token Issues
**Problem:** Token not being sent or expired on live server

**Check:** Browser DevTools → Application → Local Storage → `accessToken`

### 4. Database Connection
**Problem:** Live backend connected to different database

**Check:** Backend logs for database connection

## Debugging Steps

### Step 1: Check Frontend Environment

**On Live Server (assessexpert.com):**

1. Open browser DevTools (F12)
2. Go to Console tab
3. Type:
```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)
console.log('Token:', localStorage.getItem('accessToken'))
```

**Expected Output:**
```
API URL: https://assessexpert.com/api
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If API URL is wrong:**
- Frontend not built with production env vars
- Need to rebuild with `.env.production`

### Step 2: Test API Directly

**From Browser Console on assessexpert.com:**

```javascript
// Get current user
const token = localStorage.getItem('accessToken')
const userId = JSON.parse(localStorage.getItem('user')).id

// Test GET availability
fetch(`https://assessexpert.com/api/users/${userId}/availability`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log('GET result:', d))
.catch(e => console.error('GET error:', e))

// Test POST availability
fetch(`https://assessexpert.com/api/users/${userId}/availability`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    slots: [{
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '17:00'
    }],
    timezone: 'Asia/Dubai',
    maxSessionsPerDay: 4
  })
})
.then(r => r.json())
.then(d => console.log('POST result:', d))
.catch(e => console.error('POST error:', e))
```

### Step 3: Check Backend Logs

**On Live Server:**

```bash
# Check if backend is running
pm2 list

# View logs
pm2 logs assessexpert-backend --lines 100

# Filter for availability
pm2 logs assessexpert-backend | grep -i availability
```

**Look for:**
```
[UsersService] Saving availability for proctor: clxxx...
[UsersService] Created X new slots
```

**If no logs:**
- API endpoint not being called
- Check frontend is sending to correct URL

### Step 4: Check Database

**Connect to Live Database:**

```sql
-- Check if ProctorAvailability table exists
SELECT COUNT(*) FROM "ProctorAvailability";

-- Check recent saves
SELECT * FROM "ProctorAvailability" 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check for specific proctor
SELECT * FROM "ProctorAvailability" 
WHERE "proctorId" = 'YOUR_PROCTOR_ID';
```

## Common Issues & Solutions

### Issue 1: Frontend Using Localhost URL on Live

**Symptoms:**
- Console shows: `API URL: http://localhost:4000/api`
- Network tab shows requests to localhost (fail)

**Solution:**

1. **Create `.env.production` file:**
```bash
cd /path/to/frontend/portal
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://assessexpert.com/api
NEXT_PUBLIC_WS_URL=https://assessexpert.com
NEXT_PUBLIC_APP_NAME=assessexpert
EOF
```

2. **Rebuild frontend:**
```bash
npm run build
```

3. **Restart frontend:**
```bash
pm2 restart assessexpert-frontend
```

### Issue 2: CORS Blocking Requests

**Symptoms:**
- Console error: `CORS policy: No 'Access-Control-Allow-Origin' header`
- Network tab shows requests blocked

**Solution:**

Check backend CORS configuration in `main.ts`:

```typescript
app.enableCors({
  origin: [
    'https://assessexpert.com',
    'https://www.assessexpert.com',
    process.env.FRONTEND_URL || 'http://localhost:3000',
  ],
  credentials: true,
});
```

### Issue 3: Token Expired or Invalid

**Symptoms:**
- API returns 401 Unauthorized
- Console shows: `Token exists: false`

**Solution:**
1. Logout and login again
2. Check token in localStorage
3. Verify JWT_SECRET matches between environments

### Issue 4: Database Not Synced

**Symptoms:**
- Backend logs show "Created X slots"
- But database query shows 0 rows

**Solution:**

```bash
cd /path/to/backend
npx prisma generate
npx prisma migrate deploy
pm2 restart assessexpert-backend
```

### Issue 5: Different Database on Live

**Symptoms:**
- Localhost has data, live doesn't
- Backend logs show saves but data not persisting

**Solution:**

Check `DATABASE_URL` in backend `.env`:

```bash
# On live server
cd /path/to/backend
cat .env | grep DATABASE_URL
```

Verify it points to the correct database.

## Testing Checklist

### Frontend Checks:
- [ ] Open assessexpert.com in browser
- [ ] Open DevTools → Console
- [ ] Check `process.env.NEXT_PUBLIC_API_URL` shows live URL
- [ ] Check `localStorage.getItem('accessToken')` exists
- [ ] Go to Settings → Availability
- [ ] Click some slots
- [ ] Click "Save Availability"
- [ ] Check Console for `[Availability]` logs
- [ ] Check Network tab for POST request
- [ ] Verify POST request goes to `https://assessexpert.com/api/users/.../availability`
- [ ] Check response status (should be 200)
- [ ] Refresh page
- [ ] Verify slots still selected

### Backend Checks:
- [ ] SSH to live server
- [ ] Run `pm2 logs assessexpert-backend`
- [ ] Look for `[UsersService] Saving availability`
- [ ] Look for `[UsersService] Created X new slots`
- [ ] Check for any errors
- [ ] Query database for ProctorAvailability records

### Database Checks:
- [ ] Connect to live database
- [ ] Run: `SELECT COUNT(*) FROM "ProctorAvailability";`
- [ ] Should show > 0 if data saved
- [ ] Run: `SELECT * FROM "ProctorAvailability" ORDER BY "createdAt" DESC LIMIT 5;`
- [ ] Should show recent saves

## Console Logging Added

The frontend now logs detailed information:

**When Loading:**
```
[Availability] Loading from: https://assessexpert.com/api/users/clxxx.../availability
[Availability] Token exists: true
[Availability] Loaded data: {slots: [...], timezone: "Asia/Dubai", maxSessionsPerDay: 4}
[Availability] useEffect triggered, availabilityData: {...}
[Availability] Processing slots: [...]
[Availability] Slot: Mon 09:00 - 17:00
[Availability] Converted to grid slots: ["Mon-09:00", "Mon-10:00", ...]
```

**When Saving:**
```
[Availability] Starting save...
[Availability] User ID: clxxx...
[Availability] API URL: https://assessexpert.com/api
[Availability] Slots to save: [{dayOfWeek: 0, startTime: "09:00", endTime: "17:00"}]
[Availability] Timezone: Asia/Dubai
[Availability] Max per day: 4
[Availability] POST URL: https://assessexpert.com/api/users/clxxx.../availability
[Availability] Token exists: true
[Availability] Save response: {success: true, message: "..."}
[Availability] Save successful: {...}
```

**If Error:**
```
[Availability] Save failed: Error: ...
[Availability] Error response: {statusCode: 500, message: "..."}
[Availability] Error status: 500
```

## Quick Fix Commands

### Rebuild Frontend with Production Env
```bash
cd /path/to/frontend/portal

# Create production env file
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://assessexpert.com/api
NEXT_PUBLIC_WS_URL=https://assessexpert.com
NEXT_PUBLIC_APP_NAME=assessexpert
EOF

# Rebuild
npm run build

# Restart
pm2 restart assessexpert-frontend
```

### Check Backend Logs
```bash
pm2 logs assessexpert-backend --lines 50 | grep -i availability
```

### Test API Endpoint
```bash
# Replace TOKEN and USER_ID
curl -X GET https://assessexpert.com/api/users/USER_ID/availability \
  -H "Authorization: Bearer TOKEN"

curl -X POST https://assessexpert.com/api/users/USER_ID/availability \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slots":[{"dayOfWeek":0,"startTime":"09:00","endTime":"17:00"}],"timezone":"Asia/Dubai","maxSessionsPerDay":4}'
```

### Query Database
```sql
-- Check saves
SELECT 
  pa.*,
  u."firstName",
  u."lastName",
  u."email"
FROM "ProctorAvailability" pa
JOIN "User" u ON u.id = pa."proctorId"
ORDER BY pa."createdAt" DESC
LIMIT 10;
```

## Expected Behavior

### Correct Flow:
1. User clicks slots → Updates React state
2. User clicks "Save" → Triggers mutation
3. Frontend logs: `[Availability] Starting save...`
4. Frontend sends POST to `https://assessexpert.com/api/users/.../availability`
5. Backend logs: `[UsersService] Saving availability...`
6. Backend deletes old slots
7. Backend creates new slots
8. Backend logs: `[UsersService] Created X new slots`
9. Backend returns: `{success: true, message: "..."}`
10. Frontend logs: `[Availability] Save successful`
11. Frontend shows toast: "Availability saved successfully"
12. Frontend refetches data
13. Frontend logs: `[Availability] Loading from...`
14. Frontend logs: `[Availability] Loaded data: {...}`
15. Frontend updates UI with loaded data

### If Not Working:
- Check console logs to see where it fails
- Check Network tab to see if request is sent
- Check backend logs to see if request received
- Check database to see if data saved

## Summary

The issue is most likely one of these:

1. **Frontend using wrong API URL** → Rebuild with `.env.production`
2. **CORS blocking requests** → Update backend CORS config
3. **Token issues** → Logout and login again
4. **Database not synced** → Run Prisma migrations
5. **Different database** → Check DATABASE_URL

With the added console logging, you can now see exactly where the process fails!
