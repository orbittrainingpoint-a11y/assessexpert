# WebRTC Audio/Video & Layout Fixes - Task Tracker

## 🎯 BATCH 1: Backend + Proctor Verification Layout (THIS CHAT)

### Backend Infrastructure
- [ ] Task 2.1: Update WebSocket gateway for per-candidate audio routing
- [ ] Task 2.2: Add signaling for selective audio/video connections  
- [ ] Task 2.3: Add checklist completion tracking per candidate
- [ ] Task 2.4: Add "all verified" status endpoint

### Proctor Verification Phase Layout
- [ ] Task 3.1: Create new proctor verification layout component
- [ ] Task 3.2: Implement large active candidate view (left 75%)
- [ ] Task 3.3: Implement candidate list sidebar (right 25%)
- [ ] Task 3.4: Implement checklist panel (far right)
- [ ] Task 3.5: Add proctor self-camera (bottom left corner)
- [ ] Task 3.6: Implement candidate tile click handler
- [ ] Task 3.7: Add per-candidate checklist with green checkmarks
- [ ] Task 3.8: Implement "Verified Done All Candidate" button logic

---

## 🎯 BATCH 2: Proctor Post-Verification + Candidate Verification (NEXT CHAT)

### Proctor Post-Verification Layout
- [ ] Task 4.1: Create post-verification layout component
- [ ] Task 4.2: Implement screen-share grid (center area)
- [ ] Task 4.3: Add "Push MCQ Exam" button (always active)
- [ ] Task 4.4: Add "Push Practical Exam" button (conditional enable)
- [ ] Task 4.5: Add notification area panel
- [ ] Task 4.6: Add disqualify button
- [ ] Task 4.7: Keep proctor self-camera visible

### Candidate Verification Phase Layout
- [ ] Task 5.1: Create candidate verification layout component
- [ ] Task 5.2: Add header bar with "Candidate Screen" label
- [ ] Task 5.3: Implement proctor camera view (hidden until active)
- [ ] Task 5.4: Implement candidate self-camera view
- [ ] Task 5.5: Add checklist progress display (bottom area)
- [ ] Task 5.6: Remove fullscreen enforcement

---

## 🎯 BATCH 3: Candidate Exam + WebRTC Audio (FINAL CHAT)

### Candidate Exam Phase Layout
- [ ] Task 6.1: Create candidate exam phase layout
- [ ] Task 6.2: Implement black background with centered text
- [ ] Task 6.3: Hide proctor camera during exam
- [ ] Task 6.4: Ensure candidate camera continues streaming

### WebRTC Audio/Video Connection Logic
- [ ] Task 7.1: Implement selective peer connection (proctor ↔ active candidate only)
- [ ] Task 7.2: Add audio mute/unmute on candidate selection
- [ ] Task 7.3: Disconnect previous candidate when switching
- [ ] Task 7.4: Enable proctor mic streaming to active candidate only
- [ ] Task 7.5: Test bidirectional audio

### Testing & Documentation
- [ ] Task 8.1: Test verification phase flow
- [ ] Task 8.2: Test exam phase flow
- [ ] Task 8.3: Test audio switching between candidates
- [ ] Task 8.4: Create testing guide
- [ ] Task 8.5: Update documentation

---

## 📝 Progress Log

### Session 1 (Current)
- **Date**: [Current Date]
- **Status**: In Progress
- **Completed**: Task list created, chunk error fix script created
- **Next**: Start Task 2.1

---

## 🚨 IMMEDIATE FIX NEEDED

**Chunk Load Error on Live Server**

Run this on live server:
```bash
ssh root@assessexpert.com
cd /var/www/html/assessexpert
chmod +x fix-chunk-error.sh
./fix-chunk-error.sh
```

This will:
1. Clear .next cache
2. Reinstall dependencies
3. Rebuild frontend
4. Restart PM2 service

---

## 📂 Files to be Created/Modified

### Backend Files
- `backend/src/modules/gateway/app.gateway.ts` - WebSocket signaling
- `backend/src/modules/checklist/checklist.service.ts` - Per-candidate tracking
- `backend/src/modules/sessions/sessions.controller.ts` - All verified endpoint

### Frontend Files
- `frontend/portal/app/(portal)/proctor/session/page.tsx` - Main session page (MAJOR REWRITE)
- `frontend/portal/components/proctor/VerificationLayout.tsx` - NEW
- `frontend/portal/components/proctor/PostVerificationLayout.tsx` - NEW
- `frontend/portal/components/proctor/CandidateTile.tsx` - NEW
- `frontend/portal/components/proctor/ChecklistPanel.tsx` - MODIFY
- `frontend/portal/app/exam/page.tsx` - Candidate exam page (MAJOR REWRITE)
- `frontend/portal/lib/useWebRTC.ts` - WebRTC hook (MAJOR REWRITE)

---

## 🎨 Layout Specifications

### Proctor Verification Phase
```
┌─────────────────────────────────────────────────────────────────┐
│  PROCTOR SESSION - VERIFICATION PHASE                           │
├──────────────────────────────────┬──────────────┬───────────────┤
│                                  │              │               │
│                                  │ Candidate 1  │               │
│                                  │ [✓ Done]     │               │
│                                  │              │               │
│   ACTIVE CANDIDATE VIEW          │ Candidate 2  │   CHECKLIST   │
│   (Large Camera Feed)            │ [Active]     │   PANEL       │
│   Orange Border                  │              │               │
│   75% Width                      │ Candidate 3  │   - ID Check  │
│                                  │              │   - Face Scan │
│                                  │ Candidate 4  │   - Room Scan │
│                                  │              │   ...         │
│                                  │ Candidate 5  │               │
│                                  │              │               │
│                                  ├──────────────┤               │
│                                  │ [Verified    │               │
│  ┌──────────┐                    │  Done All]   │               │
│  │ Proctor  │                    │  DISABLED    │               │
│  │ Self Cam │                    │              │               │
│  └──────────┘                    │              │               │
└──────────────────────────────────┴──────────────┴───────────────┘
```

### Proctor Post-Verification Phase
```
┌─────────────────────────────────────────────────────────────────┐
│  PROCTOR SESSION - EXAM PHASE                                   │
├──────────────────────────────────────────────────┬──────────────┤
│                                                  │              │
│  ┌──────────────┬──────────────┬──────────────┐ │ [Push MCQ]   │
│  │ Candidate 1  │ Candidate 2  │ Candidate 3  │ │              │
│  │ Screen+Cam   │ Screen+Cam   │ Screen+Cam   │ │ [Push        │
│  └──────────────┴──────────────┴──────────────┘ │  Practical]  │
│                                                  │  DISABLED    │
│  ┌──────────────┬──────────────┐                │              │
│  │ Candidate 4  │ Candidate 5  │                │              │
│  │ Screen+Cam   │ Screen+Cam   │                │ Notification │
│  └──────────────┴──────────────┘                │ Area         │
│                                                  │              │
│  ┌──────────┐                                    │ [DISQUALIFY] │
│  │ Proctor  │                                    │              │
│  │ Self Cam │                                    │              │
│  └──────────┘                                    │              │
└──────────────────────────────────────────────────┴──────────────┘
```

### Candidate Verification Phase
```
┌─────────────────────────────────────────────────────────────────┐
│  CANDIDATE SCREEN                                               │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│   PROCTOR CAMERA                │   CANDIDATE                   │
│   (Hidden until proctor         │   Screen and Camera           │
│    clicks this candidate)       │   (Self view)                 │
│                                 │                               │
│                                 │                               │
└─────────────────────────────────┴───────────────────────────────┘
│                                                                 │
│   CHECKLIST PROGRESS                                            │
│   ✓ ID Verification Complete                                   │
│   ✓ Face Scan Complete                                         │
│   ⏳ Room Scan In Progress...                                   │
│   ⬜ Audio Check Pending                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Candidate Exam Phase
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│              Candidate Exam Screen After Starting Exam          │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation Notes

### WebRTC Selective Connection
- Use `RTCPeerConnection` per candidate
- Store connections in Map: `Map<candidateId, RTCPeerConnection>`
- On candidate click: create/activate connection, mute others
- On candidate switch: close previous connection, open new one

### Checklist Per-Candidate Tracking
- Database: Add `candidateId` field to checklist items
- Track completion per candidate
- Emit WebSocket events on each item completion
- Calculate "all verified" status server-side

### Layout State Management
- Use React state: `phase: 'verification' | 'exam'`
- Use React state: `activeCandidateId: string | null`
- Use React state: `verifiedCandidates: Set<string>`
- Transition phase when all candidates verified

---

## 📊 Success Criteria

- [ ] Proctor can hear candidate during verification
- [ ] Candidate can hear proctor during verification
- [ ] Audio switches when proctor clicks different candidate
- [ ] Only active candidate hears proctor
- [ ] Proctor sees large view of active candidate
- [ ] Candidate list shows all candidates with status
- [ ] Checklist panel shows current candidate's checklist
- [ ] Green checkmark appears when candidate verified
- [ ] "Verified Done All" button enables when all done
- [ ] Layout transitions to exam phase correctly
- [ ] Candidate sees proctor only during their verification
- [ ] Candidate sees black screen during exam
- [ ] No fullscreen enforcement on candidate side

---

**Status**: Ready to begin Task 2.1
**Next Action**: Update WebSocket gateway for per-candidate audio routing
