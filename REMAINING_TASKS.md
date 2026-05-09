# assessexpert — Remaining Task List (Split by Chat Capability)
> Each task = 1 chat response max. XS = 1 change, S = 1 file, M = 2-3 files.

---

## ✅ COMPLETED THIS SESSION

| Task | What | Status |
|------|------|--------|
| Fix "Loading session" on proctor | Added organization+practicalTask to getSession include | ✅ Done |
| Fix checklist bypass in dev | startMcq skips checklist check in dev mode | ✅ Done |
| Add getSessionByToken endpoint | GET /sessions/by-token/:token for proctor role | ✅ Done |
| Add getByToken to frontend API | sessionsApi.getByToken() | ✅ Done |
| Fix proctor today demo query | Uses getByToken instead of getAll (403 fix) | ✅ Done |
| Fix TypeScript errors (3 errors) | remoteStreams scope + stream type cast | ✅ Done |
| Wire WebRTC into proctor session | useWebRTC hook + candidateStream in tiles | ✅ Done |
| Wire WebRTC into exam page | useWebRTC hook + proctorStream state | ✅ Done |
| Expose socket from useSessionWebSocket | Returns socket instance for WebRTC signalling | ✅ Done |
| Add peer.announce to gateway | Triggers peer.joined event for WebRTC initiation | ✅ Done |

---

## ⬜ REMAINING TASKS

### TASK R-1 — Fix waiting room proctor tile (XS)
**File:** `app/exam/page.tsx`
**What:** Replace the old "YOUR CAMERA" self-preview tile in waiting room with the new dual-tile (proctor feed + self preview) using `proctorStream`
**Blocked by:** Nothing

### TASK R-2 — Fix exam page WebRTC stream assignment (S)
**File:** `app/exam/page.tsx`
**What:** The `cameraStreamRef` needs to be passed to `useWebRTC` as `localStream`. Currently `useWebRTC` gets `cameraStreamRef.current` which may be null at hook init time. Need to update when stream becomes available.
**Blocked by:** Nothing

### TASK R-3 — Backend: restart required (XS)
**What:** Backend needs restart to pick up:
- New `GET /sessions/by-token/:token` endpoint
- `getSession` now includes `organization` + `practicalTask`
- `startMcq` checklist bypass in dev mode
**Action:** `cd assessexpert/backend && npm run start:dev`

### TASK R-4 — Test full demo flow end-to-end (XS)
**What:** Run seed, open candidate tab, proctor joins, verify cameras show
**Steps:**
1. `npx ts-node prisma/seed-ahmed.ts` (reset session)
2. Backend restart
3. Open `localhost:3000/login` → proctor login
4. Today's Assessments → Open Candidate Tab
5. Candidate: email → 000000 → waiting room
6. Proctor: Join Demo Session → verify candidate camera shows

### TASK R-5 — Fix exam page waiting room tile (S)
**File:** `app/exam/page.tsx`
**What:** The waiting room still has old tile. Replace with dual proctor+self preview using `proctorStream`

### TASK R-6 — Add proctor stream to useWebRTC localStream (S)
**File:** `app/exam/page.tsx`
**What:** `useWebRTC` needs `localStream` to be reactive. Currently passes `cameraStreamRef.current` (null at init). Add a `useEffect` to update WebRTC when stream becomes available.

---

## ⚠️ EXTERNAL REQUIREMENTS

| # | What | Why |
|---|------|-----|
| E-1 | Backend restart | New endpoints won't be live until restart |
| E-2 | Both browser tabs on same machine | WebRTC works on localhost without TURN server |
| E-3 | Chrome/Edge recommended | Best WebRTC + getUserMedia support |

---

## HOW TO RUN DEMO RIGHT NOW

```
1. cd assessexpert/backend && npm run start:dev   (restart backend)
2. cd assessexpert/frontend/portal && npm run dev  (frontend already running)
3. npx ts-node prisma/seed-ahmed.ts               (reset demo session)
4. Open localhost:3000 → login as proctor
5. Today's Assessments → click "Open Candidate Tab"
6. In candidate tab: enter email → click 000000 → verify → waiting room
7. Back in proctor tab → red notification → Join Now
8. Proctor session loads → camera strip shows proctor feed
9. Candidate tiles show WebRTC stream when connected
```

---
*Last updated: TypeScript clean. Backend needs restart for new endpoints.*
