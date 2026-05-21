# AssessExpert — Functional Specification Document

**Version:** 1.0 &nbsp;·&nbsp; **Companion to:** [PRD.md](PRD.md), [TSD.md](TSD.md)

This document describes **how the system behaves from a user's perspective**: every primary flow, the state machines underneath, the validation rules, and the edge cases the implementation handles.

---

## 1. Role-Based Access Summary

| Capability | SUPER_ADMIN | ORG_ADMIN | HR_MANAGER | HIRING_MGR | MASTER_PROCTOR | PROCTOR | EXAM_SETUP | CANDIDATE |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Create org | ✓ | | | | | | | |
| Manage users | ✓ | ✓ | | | | | | |
| Manage candidates | ✓ | ✓ | ✓ | | | | | |
| GDPR-delete candidate | ✓ | | | | | | | |
| Schedule session | ✓ | ✓ | ✓ | | | | | |
| Author MCQs | ✓ | | | | ✓ | | ✓ | |
| Author practicals | ✓ | | | | ✓ | | ✓ | |
| Run live session | ✓ | | | | ✓ | ✓ | | |
| Generate report draft | ✓ | | | | ✓ | ✓ | | |
| Publish report | ✓ | | | | ✓ | ✓ | | |
| View published reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Take exam | | | | | | | | ✓ |
| Platform settings | ✓ | | | | | | | |
| Audit log | ✓ | | | | | | | |

## 2. HR Flow — Schedule a Candidate

1. **Add candidate** under HR → Candidates. Email + organisation must be unique. Optional fields: phone, job position, department, notes.
2. **Click "Schedule"** on a candidate row.
3. Modal opens with assessment-type picker. After picking, the system fetches **available slots** from `/scheduling/slots` (based on proctor availability for the next 7 days).
4. HR picks a slot. The system attempts `scheduleSession` which does:
   - Validate the candidate belongs to the calling user's org
   - Look for an **existing slot within ±60 seconds** of the requested time, same proctor + assessment + org, status SCHEDULED
   - If found and the candidate isn't already in it → **auto-merge**: add a `SessionCandidate` row, leave the magic link unchanged, send the candidate an invitation with the shared link
   - Otherwise create a new `ExamSession` (with `isMultiCandidate=true`, `status=SCHEDULED`) and a `SessionCandidate` row for the primary
5. **Invitation email** sent immediately. The response carries `invitationSent: boolean, invitationError: string?` — the modal surfaces this so HR sees "Scheduled, but email failed" instead of silently lying.
6. **Reminder emails** scheduled for 24h and 1h before the slot via Bull queue (in-memory fallback if Redis is down).

### Reschedule

HR opens an existing scheduled slot and clicks "Reschedule". Allowed only when `session.status ∈ {SCHEDULED, INVITED, NO_SHOW}`. The system:
- Generates a fresh magic token (invalidating the old link)
- Updates `scheduledAt`
- Sends `sendRescheduleNotice` (dedicated "Your assessment has been rescheduled" subject — not a duplicate invitation)

## 3. Candidate Flow — Take an Exam

1. **Magic link arrives by email.** Candidate clicks it; lands on `/exam?token=<32hex>`.
2. **Link verification** — frontend calls `verifyMagicToken`. Returns session info if `tokenExpiresAt` is in the future; otherwise shows "link expired".
3. **OTP screen** — candidate types their email + ticks Terms / Privacy. Backend:
   - Looks up the session by token
   - Compares the typed email (case-insensitive, trimmed) against the primary candidate + every `SessionCandidate.candidate.email`
   - Per-email rate limit: 3 OTP issuances per 5 minutes (Redis-backed)
   - Sends a 6-digit OTP via SMTP, stored in Redis with 10-minute TTL
4. **OTP verify** — Redis lookup, 3-attempt cap (key burned after 3 failures), returns the resolved `candidateId` to the browser so subsequent calls carry it.
5. **Tech check** (existing screen, translated to Arabic) — verifies camera + mic + speakers + network.
6. **Verification phase** — candidate joins LiveKit/WebRTC, publishes camera + mic, waits for the proctor.
7. **MCQ phase** — when the proctor pushes MCQ, the candidate's screen flips to the MCQ panel:
   - Server returns one question at a time (`getCurrentQuestion`)
   - Each `submitAnswer` records to `ExamAnswer` with `position`
   - On submitting the 25th, the backend calls `completeMcq(sessionId, candidateId)` — flips `SessionCandidate.status = MCQ_SUBMITTED`
   - If THIS candidate is the last one still going, `session.status` flips to `MCQ_COMPLETE` AND `autoAssignRandomSets` fires for the slot
8. **Waiting screen** while other candidates finish (if multi-candidate).
9. **Practical phase** — when proctor pushes practical, candidate sees their assigned set (already auto-picked from active library), downloads any files, works in their own software, uploads result.
10. **Practical submit** flips `SessionCandidate.status = PRACTICAL_SUBMITTED`. When everyone's done, `session.status = SUBMITTED`.
11. **Thank-you screen.** Recording finalize runs in the background; report drafting kicks off when the proctor reviews.

### Auto-submit on timer expiry

- **MCQ timer** is session-wide, started at `mcqStartedAt`, length `assessmentType.mcqTimeLimit * 60` seconds.
- When client countdown reaches 0:
  1. Browser fires `POST /exam/timer/expired` with `phase=mcq` and the candidateId
  2. Backend re-validates against server time — rejects if timer hasn't actually expired (defence against tampered clocks)
  3. `autoSubmitMcq` fills blank `ExamAnswer` rows for every unanswered question (isCorrect=false, marks=0)
  4. `completeMcq` runs as if the candidate had hit submit
- **Safety net cron:** `sweepExpiredExams` runs every minute, picks up any session where the server-side timer expired but no client notification arrived (closed-tab case).

## 4. Proctor Flow — Run a Session

The proctor opens `/proctor/session?id=<sessionId>` from "Today's Assessments".

### 4.1 Verification phase

1. Page loads `session` + `sessionCandidates`. The unified UI renders **one tile per candidate** in a grid.
2. **Auto-select** the first candidate. Audio routing now targets that candidate exclusively (proctor's outbound video + audio is muted to every other tile until they're selected).
3. Proctor walks the **per-candidate checklist** on the right panel:
   - Camera Verification (visual confirm)
   - Verbal Identity — Name (must match record exactly, case-insensitive)
   - Verbal Identity — Email (must match record)
   - Government ID Check (capture photo + run FR)
   - Environment Scan (360° room rotation)
   - No Unauthorised Materials
   - Facial Recognition (server-side comparison to reference photo, returns similarity + outcome)
   - Screen Share (proctor requests, candidate accepts; only entire-screen accepted, windows/tabs rejected)
   - GuardPro / Tech Check (manual confirmation — no auto-integration yet)
   - Guidelines & Agreement (proctor reads aloud, candidate clicks "I agree" → socket round-trip)
4. **Completing a checklist** writes `ProctorChecklist.completedAt` AND flips that candidate's `SessionCandidate.status = VERIFIED`. The proctor UI re-derives `allVerified` from this status field, so a page refresh doesn't lose progress.
5. **Switching candidates** keeps the checklist's per-candidate progress map intact. Hydration re-runs from the backend on the new active candidate so completed items render as "done".
6. **"All Candidates Verified — Start Exam"** button enables once every `SessionCandidate` row is in `VERIFIED` (or any later phase).

### 4.2 MCQ phase

1. Proctor clicks **"Push MCQ"** in PostVerificationLayout.
2. `sessionsApi.begin` runs `startMcq` server-side:
   - Validates every candidate has a completed checklist (production-only enforcement)
   - Pulls the active question pool for `assessmentTypeId` (requires ≥25 questions)
   - For each candidate: generates a random seed, deterministically shuffles, picks the first 25, writes a `SessionQuestionAssignment` row
   - Flips `session.status = MCQ_IN_PROGRESS`, sets `mcqStartedAt`
3. Backend emits `exam.pushMCQ` over socket → candidates' browsers switch to MCQ panel.
4. Proctor dashboard now shows:
   - Each candidate's live camera + screen-share thumbnails
   - Per-candidate question-progress bar
   - AI flag queue (multiple faces, face absent, tab switches, etc.)
   - Live score (from `exam.mcqSubmitted` socket events)
   - Pause / Resume / Terminate buttons
5. When each candidate submits, `SessionCandidate.status = MCQ_SUBMITTED`. The proctor tile shows a "✓ MCQ Submitted" badge.
6. When the LAST candidate finishes, `session.status = MCQ_COMPLETE` and `autoAssignRandomSets` runs.

### 4.3 Practical phase

1. The proctor view switches to `PracticalPanel`, showing every candidate's MCQ score + their auto-assigned practical set (already picked).
2. Proctor can manually override any candidate's set or task via the picker.
3. Proctor clicks "Assign Practical" — service flips `session.status = PRACTICAL_IN_PROGRESS`, sets `practicalStartedAt`, broadcasts `exam.pushPractical`.
4. Candidates see their practical set, download files, work in their own software, upload result.
5. Practical timer + auto-submit work the same as MCQ.

### 4.4 Report phase

1. When `session.status = SUBMITTED` (every candidate done), the proctor sees a "Review & Publish Report" link.
2. Clicking generates the draft via `generateDraftReport(sessionId, candidateId)` — pulls MCQ answers, integrity score, AI narrative.
3. Proctor adds notes, ratings, optional recordings annotation, clicks "Submit for Review".
4. `MASTER_PROCTOR` (or any senior approver) reviews and either Returns (status RETURNED, back to proctor) or Publishes (status PUBLISHED).
5. On publish:
   - HR receives an email + in-portal notification
   - Candidate receives a courtesy email (org-level opt-out via `notify_candidate_on_publish`)
   - WebSocket `report.published` event broadcast
   - Audit log row written

## 5. State Machines

### ExamSession.status

```
SCHEDULED
  │  proctor opens session UI
  ▼
CHECKLIST
  │  every checklist completed + proctor pushes MCQ
  ▼
MCQ_IN_PROGRESS                                  (DISQUALIFIED — terminal)
  │  every candidate's MCQ submitted              ▲ (NO_SHOW — terminal)
  ▼                                               │ (CANCELLED — terminal)
MCQ_COMPLETE  → triggers autoAssignRandomSets    │
  │  proctor pushes practical                     │
  ▼                                               │
PRACTICAL_IN_PROGRESS                             │
  │  every candidate's practical submitted        │
  ▼                                               │
SUBMITTED
  │  draft generated + reviewed
  ▼
GRADING → PENDING_PROCTOR_REVIEW → REPORT_PUBLISHED
```

### SessionCandidate.status

```
PENDING → JOINED → VERIFYING → VERIFIED
                                  │
                                  ▼
                          MCQ_IN_PROGRESS
                                  │
                                  ▼
                          MCQ_SUBMITTED
                                  │
                                  ▼
                          PRACTICAL_IN_PROGRESS
                                  │
                                  ▼
                          PRACTICAL_SUBMITTED
                                  │
                                  ▼
                             COMPLETED
                                  │
                  (DISQUALIFIED — terminal at any point)
```

### Report.status

```
DRAFT → PENDING_REVIEW → PUBLISHED
              │
              ▼
            RETURNED → PENDING_REVIEW → PUBLISHED
```

## 6. Business Rules

### Scheduling
- A candidate cannot be scheduled to another org's slot
- Auto-merge window is ±60 seconds, same proctor + assessment + org, only when both are SCHEDULED
- Reschedule allowed only for SCHEDULED / INVITED / NO_SHOW status
- Magic-link valid from "scheduledAt − 15 min" to "scheduledAt + 15 min" — outside this window the candidate sees "not open" / "expired"

### Verification
- Every candidate's checklist must complete before MCQ can start (production-only enforcement; dev mode skips for faster iteration)
- Identity-name and identity-email items REQUIRE the input to exactly match the candidate's record (case-insensitive)
- Government ID + Facial Recognition both require a captured image with a detectable face; outcome=REJECTED blocks completion
- Screen Share rejects windows / tabs; entire-screen only (enforced by `displaySurface !== 'monitor'`)

### MCQ
- Pool must have ≥25 ACTIVE questions for the assessment type, or startMcq throws
- Per-candidate shuffle uses an independent random seed → different orders per candidate
- A candidate who already submitted (status terminal) is blocked from fetching or submitting more questions
- Auto-submit fills blank answers (isCorrect=false, marks=0) when the timer expires
- The session's MCQ_COMPLETE transition is gated on EVERY candidate finishing — one finisher cannot lock the others out

### Practical
- Auto-assignment uses ACTIVE PracticalPaperSets matching the assessmentTypeId
- Candidates with an existing assignment (proctor override or prior auto-pick) are left alone — idempotent
- Multi-candidate slots: different candidates can receive different sets (random per candidate)
- Upload extension blocklist: `.svg, .html, .htm, .xhtml, .xml, .js, .mjs`
- Practical submit is per-candidate; session SUBMITTED only when ALL have finished

### Reports
- Multi-candidate slots produce N reports (one per candidate)
- Only PUBLISHED reports are visible to HR_MANAGER / HIRING_MANAGER / ORG_ADMIN
- SUPER_ADMIN / MASTER_PROCTOR see all statuses
- HR rating + note can be added after publish

### Notifications

| Event | Recipient | Channel |
|---|---|---|
| Session scheduled | Candidate | Email |
| Session rescheduled | Candidate | Email (distinct template) |
| 24h before exam | Candidate | Email (Bull-scheduled) |
| 1h before exam | Candidate | Email (Bull-scheduled) |
| Report published | HR users in org | Email + in-portal notification |
| Report published | Candidate | Email (opt-out per org) |
| MCQ auto-submitted | Proctor | Socket event |
| Behaviour anomaly | Proctor | Socket flag |

## 7. Validation Rules (selected)

| Field / Input | Rule | Enforcement |
|---|---|---|
| Email | Lowercase + trim before any compare or DB query | `normalizeEmail()` |
| OTP | 6 digits, 10-minute TTL, 3-attempt cap | Redis + Bull |
| OTP issuance | 3 per email per 5 minutes | Redis INCR + EXPIRE |
| Verification transcript line | Max 5000 chars; candidateId must belong to session | Service-layer |
| CSV bulk import | ≤5000 rows; RFC-4180 parsing | csv-parse |
| Settings — retention days | 1–3650 (integer) | `NUMERIC_SETTING_BOUNDS` |
| Settings — FR thresholds | 0–100 (number) | `NUMERIC_SETTING_BOUNDS` |
| GDPR delete reason | ≥10 chars | Controller-level |
| Practical numeric answer | `Number.isFinite` guard, NaN dropped | Controller-level |
| Pagination `limit` | Clamped at 500 (1000 for audit log) | Service-level |
| JWT secret | ≥32 chars at boot | main.ts boot guard |
| FRONTEND_URLS in prod | Non-empty | main.ts boot guard |

## 8. Error Handling

- **HttpException** → status + message returned verbatim (these are tailored for the client)
- **Native Error** in production → response shows only `{ statusCode, message: "Internal server error", path }`
- **Native Error** in development → response includes `details` with stack trace
- Server-side logs always carry the full error with stack regardless of environment
- Pre-commit hooks (typecheck, lint) prevent broken merges

## 9. Edge Cases the Implementation Handles

- **Glare-free WebRTC** — only the CANDIDATE initiates an offer; proctor waits and answers
- **Proctor refresh during verification** — checklist state hydrates from `ProctorChecklist`; `SessionCandidate.status` is the durable "verified" flag
- **Candidate refresh during MCQ** — server timer is authoritative; the answer they were on is re-fetched via `getCurrentQuestion`
- **Candidate closes tab + timer expires** — server-side cron auto-submits within 60 seconds
- **Clock tampering** — `/exam/timer/expired` re-validates against server time
- **Audit log concurrent writers** — Serializable transaction prevents chain-hash forks
- **Redis outage** — falls back to in-memory store; OTPs + signed URLs still work for the lifetime of the process
- **SMTP outage** — failures recorded in `/admin/email-health`; session creation still succeeds
- **Recording crash mid-session** — orphan-finalize cron picks up leftover chunks every 2h
- **Reschedule** — old magic link burns; new link sent with explicit "Rescheduled" subject

## 10. Verification Status

The behaviours documented in this FSD are backed by the implemented code paths in the current repo. As of the date of this document:
- ✅ Type-check passes cleanly on backend and frontend (0 errors)
- ✅ All 11 gaps from the most recent audit are fixed
- ✅ Unified multi-candidate UI is the only UI; the single-candidate branches are gone
- ✅ Auto-submit on timer (client trigger + cron sweep) is wired
- ✅ Random practical-set auto-assignment fires from `completeMcq`
- ✅ Single source of truth for "verified" state is `SessionCandidate.status`
- ⚠️ End-to-end manual smoke test in a staging environment is the final gate before each production deploy — automated integration tests are planned but not yet in scope.
