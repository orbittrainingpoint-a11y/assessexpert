# 403 Forbidden Error on /api/sessions - Explained

## Error Message
```
api/sessions?limit=30:1 Failed to load resource: the server responded with a status of 403 (Forbidden)
```

## What This Means

**403 Forbidden** = "You don't have permission to access this resource"

This is **NOT a bug** - it's the security system working correctly!

## Why You're Getting This Error

### The `/api/sessions` Endpoint Requires Specific Roles:

**Backend Code:**
```typescript
@Get()
@Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
async getAllSessions(@Query() filters: any) {
  return this.sessionsService.getAllSessions(filters);
}
```

**Who CAN access:**
- ✅ `SUPER_ADMIN`
- ✅ `MASTER_PROCTOR`

**Who CANNOT access:**
- ❌ `PROCTOR`
- ❌ `HR_MANAGER`
- ❌ `ORG_ADMIN`
- ❌ `HIRING_MANAGER`

## Common Scenarios

### Scenario 1: You're Logged in as Proctor
**Your Role:** `PROCTOR`
**Trying to Access:** `/api/sessions` (all sessions)
**Result:** 403 Forbidden ❌

**Why:** Proctors should only see their assigned sessions, not all sessions.

**What You Should Use Instead:**
```
GET /api/sessions/today
```
This endpoint is available for `PROCTOR` role and shows only your assigned sessions.

### Scenario 2: You're Logged in as HR Manager
**Your Role:** `HR_MANAGER`
**Trying to Access:** `/api/sessions` (all sessions)
**Result:** 403 Forbidden ❌

**Why:** HR Managers should only see sessions for their organization.

**What You Should Use Instead:**
```
GET /api/sessions?organizationId=YOUR_ORG_ID
```
Or the sessions are shown through the candidates page.

### Scenario 3: You're on the Wrong Page
**Problem:** You're a Proctor but accidentally navigated to the Master Proctor dashboard

**Solution:** Go to your correct dashboard:
- Proctor → `/proctor`
- HR Manager → `/hr`
- Master Proctor → `/master-proctor`

## How to Fix

### Option 1: Ignore It (Recommended)
If you're seeing this error but the page still works, you can safely ignore it. The frontend should handle the 403 error gracefully.

### Option 2: Check Your Role
1. Open Browser Console (F12)
2. Type:
```javascript
console.log('My Role:', JSON.parse(localStorage.getItem('user'))?.role)
```

3. Check which role you have
4. Make sure you're on the correct dashboard for your role

### Option 3: Login as Correct Role
If you need to access all sessions:
1. Logout
2. Login as Super Admin or Master Proctor
3. Navigate to Master Proctor dashboard

## Available Endpoints by Role

### PROCTOR Role:
```
✅ GET /api/sessions/today - Your assigned sessions today
✅ GET /api/sessions/:id - Specific session details
✅ POST /api/sessions/:id/begin - Start assessment
✅ POST /api/sessions/:id/terminate - Terminate session
❌ GET /api/sessions - All sessions (403 Forbidden)
```

### HR_MANAGER Role:
```
✅ GET /api/candidates - Your organization's candidates
✅ POST /api/scheduling/schedule - Schedule assessments
✅ GET /api/sessions/:id - Specific session details
❌ GET /api/sessions - All sessions (403 Forbidden)
```

### MASTER_PROCTOR Role:
```
✅ GET /api/sessions - All sessions
✅ GET /api/sessions/live - Live sessions
✅ GET /api/sessions/today - Today's sessions
✅ All proctor endpoints
```

### SUPER_ADMIN Role:
```
✅ All endpoints (full access)
```

## Is This a Problem?

**NO!** This is correct security behavior.

### Why 403 is Good:
- ✅ Prevents unauthorized access
- ✅ Protects sensitive data
- ✅ Enforces role-based access control
- ✅ Follows security best practices

### When to Worry:
- ❌ If you CAN'T access pages you should be able to
- ❌ If you're logged in as Super Admin and getting 403
- ❌ If the page doesn't work at all

## Checking Your Current Role

**In Browser Console:**
```javascript
// Check your role
const user = JSON.parse(localStorage.getItem('user'))
console.log('Role:', user?.role)
console.log('Email:', user?.email)
console.log('Name:', user?.firstName, user?.lastName)
```

**Expected Output:**
```
Role: PROCTOR
Email: proctor@assessexpert.ae
Name: John Doe
```

## What Page Are You On?

The error appears when:
1. **Master Proctor Dashboard** tries to load all sessions
2. **Admin Dashboard** tries to load all sessions
3. **A component** tries to fetch sessions without checking role first

**If you're a Proctor:**
- You should be on `/proctor` dashboard
- Not on `/master-proctor` or `/admin` dashboard

**If you're an HR Manager:**
- You should be on `/hr` dashboard
- Not on `/master-proctor` or `/admin` dashboard

## How to Suppress the Error (If Needed)

If the error is annoying but the page works fine, you can suppress it by updating the frontend to check the role before making the API call:

```typescript
// Only fetch all sessions if user has permission
const { data: sessions } = useQuery({
  queryKey: ['sessions'],
  queryFn: () => sessionsApi.getAll(),
  enabled: ['SUPER_ADMIN', 'MASTER_PROCTOR'].includes(user?.role),
})
```

## Summary

### ✅ This is CORRECT Behavior:
- 403 Forbidden means you don't have permission
- This protects sensitive data
- Each role has specific endpoints they can access

### ❌ This is NOT a Bug:
- The security system is working as designed
- Proctors shouldn't see all sessions
- HR Managers shouldn't see all sessions

### 🔧 What to Do:
1. **Check your role** - Are you logged in with the right account?
2. **Check your page** - Are you on the right dashboard?
3. **Ignore if page works** - If the page functions correctly, ignore the error
4. **Contact admin** - If you need higher permissions, ask your admin

## Need Higher Permissions?

If you legitimately need access to all sessions:
1. Contact your Super Admin
2. Request role change to `MASTER_PROCTOR` or `SUPER_ADMIN`
3. They can update your role in the database

**Database Query (Admin Only):**
```sql
-- Check current role
SELECT id, email, role FROM "User" WHERE email = 'your@email.com';

-- Update role (if authorized)
UPDATE "User" SET role = 'MASTER_PROCTOR' WHERE email = 'your@email.com';
```

---

**Bottom Line:** The 403 error is the security system working correctly. You're trying to access something your role doesn't have permission for. This is expected and safe! ✅
