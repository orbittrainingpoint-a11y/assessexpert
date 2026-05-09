# Proctor Availability Settings - Fix Complete

## Issue
Proctor availability settings were not persisting after page refresh. The settings would save but not reload from the database.

## Root Cause
1. **No backend API** - There were no endpoints to save/load availability data
2. **Frontend only stored in state** - Data was only in React state, not persisted to database
3. **No database integration** - The ProctorAvailability table existed but wasn't being used

## Solution Implemented

### Backend Changes

#### 1. Added Availability Endpoints (`users.controller.ts`)

```typescript
@Get(':id/availability')
@Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
async getAvailability(@Param('id') id: string, @Req() req: any)

@Post(':id/availability')
@Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
async saveAvailability(@Param('id') id: string, @Body() body: any, @Req() req: any)
```

**Features:**
- ✅ Role-based access control
- ✅ Proctors can only view/edit their own availability
- ✅ Master Proctors and Super Admins can manage any proctor's availability

#### 2. Added Service Methods (`users.service.ts`)

**getAvailability(proctorId)**
- Fetches all availability slots from ProctorAvailability table
- Returns user timezone and maxSessionsPerDay preferences
- Ordered by day and time

**saveAvailability(proctorId, data)**
- Deletes existing availability slots
- Creates new slots based on user selection
- Updates user timezone and maxSessionsPerDay
- Comprehensive logging for debugging

### Frontend Changes

#### 1. Added Data Loading (`proctor/settings/page.tsx`)

```typescript
const { data: availabilityData, refetch } = useQuery({
  queryKey: ['availability', user?.id],
  queryFn: async () => {
    const res = await axios.get(`/users/${user.id}/availability`)
    return res.data
  },
})
```

**Features:**
- ✅ Loads availability on page load
- ✅ Converts database slots to UI grid format
- ✅ Loads timezone and maxSessionsPerDay preferences

#### 2. Added Data Saving

```typescript
const saveAvailabilityMutation = useMutation({
  mutationFn: async () => {
    // Convert UI grid to database slots
    const slots = convertGridToSlots(available)
    await axios.post(`/users/${user.id}/availability`, {
      slots,
      timezone,
      maxSessionsPerDay: maxPerDay,
    })
  },
  onSuccess: () => {
    toast.success('Availability saved successfully')
    refetchAvailability()
  },
})
```

**Features:**
- ✅ Converts UI grid format to database format
- ✅ Saves timezone and maxSessionsPerDay
- ✅ Shows success/error messages
- ✅ Reloads data after save

## Data Flow

### Saving Availability

1. **User clicks slots** → Updates React state (`available` Set)
2. **User clicks "Save"** → Triggers mutation
3. **Frontend converts** → Grid format to slots array
4. **API call** → POST `/users/:id/availability`
5. **Backend deletes** → Old slots from database
6. **Backend creates** → New slots in database
7. **Backend updates** → User preferences (timezone, maxSessionsPerDay)
8. **Success response** → Shows toast notification
9. **Refetch data** → Reloads from database to confirm

### Loading Availability

1. **Page loads** → useQuery triggers
2. **API call** → GET `/users/:id/availability`
3. **Backend fetches** → Slots from ProctorAvailability table
4. **Backend fetches** → User preferences
5. **Response** → { slots, timezone, maxSessionsPerDay }
6. **Frontend converts** → Slots array to grid format
7. **UI updates** → Shows selected slots

## Database Schema

### ProctorAvailability Table

```prisma
model ProctorAvailability {
  id             String   @id @default(cuid())
  proctorId      String
  dayOfWeek      Int      // 0=Mon, 1=Tue, ..., 6=Sun
  startTime      String   // "08:00"
  endTime        String   // "17:00"
  timezone       String
  isOverride     Boolean  @default(false)
  overrideDate   DateTime?
  overrideReason String?
  createdAt      DateTime @default(now())
}
```

### User Table (relevant fields)

```prisma
model User {
  timezone          String @default("UTC")
  maxSessionsPerDay Int?
}
```

## API Endpoints

### GET /api/users/:id/availability

**Request:**
```
GET /api/users/clxxx.../availability
Authorization: Bearer <token>
```

**Response:**
```json
{
  "slots": [
    {
      "id": "clyyy...",
      "proctorId": "clxxx...",
      "dayOfWeek": 0,
      "startTime": "08:00",
      "endTime": "12:00",
      "timezone": "Asia/Dubai",
      "isOverride": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timezone": "Asia/Dubai",
  "maxSessionsPerDay": 4
}
```

### POST /api/users/:id/availability

**Request:**
```json
{
  "slots": [
    {
      "dayOfWeek": 0,
      "startTime": "08:00",
      "endTime": "12:00"
    },
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "17:00"
    }
  ],
  "timezone": "Asia/Dubai",
  "maxSessionsPerDay": 4
}
```

**Response:**
```json
{
  "success": true,
  "message": "Availability saved successfully"
}
```

## Testing

### Test Scenario 1: Save and Reload

1. Login as proctor@assessexpert.ae
2. Go to Settings → Availability
3. Click several time slots to mark as available
4. Set timezone and max sessions per day
5. Click "Save Availability"
6. ✅ Should see success message
7. Refresh the page (F5)
8. ✅ Should see the same slots selected
9. ✅ Timezone and max sessions should be preserved

### Test Scenario 2: Clear Availability

1. Login as proctor
2. Go to Settings → Availability
3. Click all selected slots to deselect them
4. Click "Save Availability"
5. ✅ Should see success message
6. Refresh the page
7. ✅ Should see no slots selected

### Test Scenario 3: Update Preferences

1. Login as proctor
2. Go to Settings → Availability
3. Change timezone to "Europe/London"
4. Change max sessions to 6
5. Click "Save Availability"
6. Refresh the page
7. ✅ Timezone should be "Europe/London"
8. ✅ Max sessions should be 6

## Logging

Backend logs show detailed information:

```
[UsersService] Getting availability for proctor: clxxx...
[UsersService] Found 5 availability slots for proctor clxxx...
[UsersService] Saving availability for proctor: clxxx...
[UsersService] Received 8 slots
[UsersService] Deleted 5 existing slots
[UsersService] Created 8 new slots
[UsersService] Updated user preferences: {"timezone":"Asia/Dubai","maxSessionsPerDay":4}
[UsersService] Availability saved successfully for proctor clxxx...
```

## Files Modified

### Backend:
1. ✅ `src/modules/users/users.controller.ts` - Added availability endpoints
2. ✅ `src/modules/users/users.service.ts` - Added availability methods with logging

### Frontend:
1. ✅ `app/(portal)/proctor/settings/page.tsx` - Added data loading and saving

## Security

- ✅ JWT authentication required
- ✅ Role-based access control (PROCTOR, MASTER_PROCTOR, SUPER_ADMIN)
- ✅ Proctors can only access their own availability
- ✅ Master Proctors can manage any proctor's availability
- ✅ Proper error handling and validation

## Next Steps

1. ✅ Test the fix with proctor@assessexpert.ae
2. ✅ Verify data persists after refresh
3. ✅ Check backend logs for any errors
4. ⏭️ Consider adding bulk availability import
5. ⏭️ Consider adding availability templates
6. ⏭️ Consider adding calendar view

## Summary

✅ **Backend API created** - GET and POST endpoints for availability
✅ **Database integration** - ProctorAvailability table now used
✅ **Frontend loading** - Data loads from database on page load
✅ **Frontend saving** - Data saves to database on button click
✅ **Data persistence** - Settings survive page refresh
✅ **Comprehensive logging** - Easy to debug issues
✅ **Security** - Proper authentication and authorization

The proctor availability settings now work correctly and persist across sessions!
