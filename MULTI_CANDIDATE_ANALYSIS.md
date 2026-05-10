# Multi-Candidate Verification System - Implementation Analysis

**Date**: May 10, 2026  
**Status**: ANALYSIS COMPLETE - READY FOR IMPLEMENTATION

---

## 🔍 CURRENT STATE ANALYSIS

### What Exists:
1. ✅ **VerificationLayout.tsx** - 3-section layout for verification phase
2. ✅ **PostVerificationLayout.tsx** - 2-section layout for exam monitoring
3. ✅ **CandidateTile.tsx** - Candidate tile component
4. ✅ **WebRTC selective audio** - Proctor can connect to one candidate at a time
5. ✅ **ChecklistPanel.tsx** - Checklist component (single candidate)

### What's Missing:
1. ❌ **Multi-candidate session support** - Current system is single-candidate only
2. ❌ **Integration of VerificationLayout** - Not used in proctor session page
3. ❌ **Integration of PostVerificationLayout** - Not used in proctor session page
4. ❌ **Candidate-side verification layout** - Not implemented
5. ❌ **Candidate-side exam layout** - Not implemented
6. ❌ **Socket.io events** - Missing required real-time events
7. ❌ **Multi-candidate WebRTC** - Need to handle multiple candidate streams

---

## 📋 REQUIREMENTS SUMMARY

### PHASE 1: PROCTOR VERIFICATION SCREEN

**Layout**: 3 vertical sections (65% | 15% | 20%)

**Section A - LEFT (65%)**:
- Large active candidate camera feed
- Proctor self-camera (bottom-left PIP, 200px)
- Idle state when no candidate selected

**Section B - MIDDLE (15%)**:
- Scrollable list of candidate tiles
- Each tile shows: name, camera thumbnail, status (Pending/Done)
- Click to activate candidate
- "Verification Done — Start Exam" button at bottom (disabled until all done)

**Section C - RIGHT (20%)**:
- Checklist for active candidate
- Progress indicator
- Updates when switching candidates

**Audio/Video Rules**:
- Proctor mic/camera always ON
- Audio/video only streamed to active candidate
- One candidate at a time
- Switching disconnects previous, connects new

### PHASE 2: PROCTOR EXAM MONITORING SCREEN

**Layout**: 2 sections (75% | 25%)

**Section A - MAIN (75%)**:
- Grid of all candidates
- Each tile shows: screen share + camera PIP
- Proctor self-camera (bottom-left, fixed)

**Section B - SIDEBAR (25%)**:
- "Push MCQ Exam" button (always active)
- "Push Practical Exam" button (disabled until all MCQ done)
- Disqualify control
- Notification/activity feed

### PHASE 1: CANDIDATE VERIFICATION SCREEN

**Layout**: Header + 2 panels + bottom section

**Header**: Exam name, candidate name, phase label

**Top Row (2 equal panels)**:
- LEFT: Proctor camera (blank until proctor activates)
- RIGHT: Candidate self-camera (always visible)

**Bottom Section**:
- Checklist status (read-only, updates in real-time)
- Progress summary
- NO fullscreen enforcement

### PHASE 2: CANDIDATE EXAM SCREEN

**Layout**: Black background

- No proctor camera visible
- No candidate self-camera visible
- Camera continues streaming silently
- Exam interface loads
- Minimal status bar

---

## 🔧 IMPLEMENTATION PLAN

### STEP 1: Backend - Multi-Candidate Session Support

**Files to Modify**:
1. `backend/src/modules/sessions/sessions.service.ts`
2. `backend/src/modules/gateway/app.gateway.ts`
3. `backend/prisma/schema.prisma`

**Changes Needed**:
- Add support for multiple candidates per session
- Update ExamSession model to support candidate array
- Add CandidateSession junction table
- Update session creation logic

### STEP 2: Backend - Socket.io Events

**New Events to Add** (in app.gateway.ts):
```typescript
// Proctor events
'proctor:joined'
'proctor:enterVerification' (candidateId)
'proctor:leaveVerification' (candidateId)
'proctor:allVerified'
'exam:pushMCQ'
'exam:pushPractical'

// Checklist events
'checklist:itemUpdated' (candidateId, itemId, status)
'checklist:candidateComplete' (candidateId)

// Exam events
'exam:mcqSubmitted' (candidateId)
'exam:allMCQDone'

// Candidate events
'candidate:disqualified' (candidateId)
```

### STEP 3: Frontend - Proctor Session Page

**File**: `frontend/portal/app/(portal)/proctor/session/page.tsx`

**Changes**:
1. Replace current layout with VerificationLayout for checklist phase
2. Replace current layout with PostVerificationLayout for exam phase
3. Add multi-candidate state management
4. Add WebRTC multi-stream handling
5. Add Socket.io event handlers
6. Track verified candidates
7. Enable "Start Exam" button when all verified

### STEP 4: Frontend - Candidate Verification Layout

**New File**: `frontend/portal/components/candidate/CandidateVerificationLayout.tsx`

**Features**:
- Header bar with exam info
- Proctor camera (hidden until active)
- Candidate self-camera
- Checklist progress display
- Real-time updates via Socket.io

### STEP 5: Frontend - Candidate Exam Layout

**File**: `frontend/portal/components/candidate/CandidateExamLayout.tsx` (already exists)

**Verify**:
- Black background
- No proctor camera
- No candidate camera visible
- Camera continues streaming (hidden)

### STEP 6: Frontend - Candidate Exam Page

**File**: `frontend/portal/app/exam/page.tsx`

**Changes**:
1. Add verification phase layout
2. Add exam phase layout
3. Add Socket.io event listeners
4. Handle proctor activation/deactivation
5. Update checklist in real-time
6. Remove fullscreen enforcement

### STEP 7: WebRTC Multi-Stream Support

**File**: `frontend/portal/lib/useWebRTC.ts`

**Changes**:
1. Support multiple candidate streams
2. Track streams by candidateId
3. Handle stream switching
4. Mute/unmute based on active candidate

---

## 🚨 CRITICAL ISSUES TO FIX

### Issue 1: Single-Candidate Architecture
**Current**: System designed for 1 candidate per session
**Required**: Multiple candidates per session
**Solution**: Add CandidateSession junction table, update session logic

### Issue 2: Layouts Not Integrated
**Current**: VerificationLayout and PostVerificationLayout exist but not used
**Required**: Use these layouts in proctor session page
**Solution**: Replace current layout with phase-based layout switching

### Issue 3: Missing Candidate Layouts
**Current**: Candidate sees generic exam page
**Required**: Verification phase layout + exam phase layout
**Solution**: Create CandidateVerificationLayout, update exam page

### Issue 4: Missing Socket.io Events
**Current**: Basic events only
**Required**: 10+ new events for real-time sync
**Solution**: Add all required events to app.gateway.ts

### Issue 5: WebRTC Single Stream
**Current**: Handles one candidate stream
**Required**: Multiple candidate streams
**Solution**: Update useWebRTC to handle Map of streams

---

## 📊 IMPLEMENTATION PRIORITY

### HIGH PRIORITY (Must Have)
1. ✅ Multi-candidate session support (backend)
2. ✅ Socket.io events (backend)
3. ✅ Integrate VerificationLayout (frontend)
4. ✅ Integrate PostVerificationLayout (frontend)
5. ✅ Multi-stream WebRTC (frontend)

### MEDIUM PRIORITY (Should Have)
6. ✅ Candidate verification layout (frontend)
7. ✅ Candidate exam layout (frontend)
8. ✅ Real-time checklist sync
9. ✅ All verified button logic

### LOW PRIORITY (Nice to Have)
10. ⏳ Disqualify functionality
11. ⏳ Activity log/notifications
12. ⏳ Advanced error handling

---

## 🎯 IMPLEMENTATION APPROACH

### Option 1: Full Rewrite (Recommended)
- Create new multi-candidate session system
- Keep existing single-candidate system for backward compatibility
- Gradual migration

### Option 2: Modify Existing
- Update current session system to support multiple candidates
- Risk breaking existing functionality
- Faster but riskier

**Recommendation**: Option 1 - Full Rewrite

---

## 📝 NEXT STEPS

1. **Create database migration** for multi-candidate support
2. **Implement Socket.io events** in backend
3. **Update proctor session page** to use new layouts
4. **Create candidate verification layout**
5. **Update WebRTC hook** for multi-stream
6. **Test with 2-3 candidates**
7. **Deploy to staging**
8. **User acceptance testing**
9. **Deploy to production**

---

## ⏱️ ESTIMATED EFFORT

- **Backend Changes**: 4-6 hours
- **Frontend Proctor**: 6-8 hours
- **Frontend Candidate**: 4-6 hours
- **WebRTC Updates**: 3-4 hours
- **Testing**: 4-6 hours
- **Total**: 21-30 hours (3-4 days)

---

## 🔒 RISKS & MITIGATION

### Risk 1: Breaking Existing Sessions
**Mitigation**: Keep backward compatibility, feature flag

### Risk 2: WebRTC Complexity
**Mitigation**: Incremental testing, fallback to single stream

### Risk 3: Socket.io Performance
**Mitigation**: Event throttling, connection pooling

### Risk 4: UI/UX Confusion
**Mitigation**: Clear labels, tooltips, user testing

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Proctor can see all candidates in verification phase
2. ✅ Proctor can click candidate to activate verification
3. ✅ Audio/video only connects to active candidate
4. ✅ Checklist updates for each candidate independently
5. ✅ "Start Exam" button enables when all verified
6. ✅ Exam monitoring shows all candidate screens
7. ✅ "Push Practical" enables when all MCQ done
8. ✅ Candidate sees proctor only when active
9. ✅ Candidate checklist updates in real-time
10. ✅ No fullscreen enforcement on candidate side

---

## 🎉 CONCLUSION

The system architecture exists (VerificationLayout, PostVerificationLayout) but is not integrated. The main work is:

1. **Backend**: Add multi-candidate support + Socket.io events
2. **Frontend Proctor**: Integrate existing layouts
3. **Frontend Candidate**: Create verification layout
4. **WebRTC**: Support multiple streams

**Status**: Ready to implement  
**Complexity**: Medium-High  
**Timeline**: 3-4 days  
**Risk**: Medium (with proper testing)

---

**Next Action**: Begin implementation with STEP 1 (Backend Multi-Candidate Support)
