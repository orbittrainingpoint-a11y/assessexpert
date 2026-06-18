# Functional Gaps

What's *missing* (vs. broken) — features that are partially implemented,
half-wired, or absent altogether. Tracked separately from BUGS.md because
gaps are "we never built this" rather than "we built it wrong."

Generated 2026-06-18 alongside BUGS.md after fixing the four critical items.

---

## High-impact gaps

### G1. Interview reschedule endpoint
- **Backend:** `InterviewsService.schedule()` creates a new row each time. No
  `rescheduleInterview(id, scheduledAt)` exists.
- **Frontend:** HR has Cancel + "Schedule new" but no reschedule UI action.
- **Why it matters:** HR has to cancel + recreate, which mints a NEW magic
  link and triggers a NEW invitation email. Confusing for the candidate.
- **Suggested:** `POST /interviews/:id/reschedule { scheduledAt }`. Reuses
  current magicToken but pushes `tokenExpiresAt` forward, sends a
  reschedule email (template already exists for exam reschedules).
- **Effort:** ~1 hour.

### G2. Atomic exam-magic-link verification
- **Backend:** `ExamDeliveryService.verifyMagicLink()` reads then writes
  `tokenUsedAt` in two separate queries. Race window: two browser tabs
  hitting the same link concurrently can both succeed.
- **Suggested:** wrap in a transaction or use Prisma's `update` with a
  `where: { magicToken, tokenUsedAt: null }` clause and check `result.count`.
- **Effort:** 30 min.

### G3. Wire H4's `CANDIDATE_ORG_MISMATCH` to a real UI banner
- **Backend:** Throws `ForbiddenException({ code: 'CANDIDATE_ORG_MISMATCH' })`
  now (BUGS H4 ✅).
- **Frontend:** [hr/interviews/[id]/page.tsx](frontend/portal/app/(portal)/hr/interviews/[id]/page.tsx)
  still treats any failed candidate fetch as "no reference photo" silently.
- **Suggested:** catch on the React Query for `interview-cand`; when error
  status is 403 with `data.code === 'CANDIDATE_ORG_MISMATCH'`, render an
  amber banner above the rail.
- **Effort:** 20 min.

### G4. No proctor-side audit log of when active candidate changes
- **What's missing:** when proctor switches active candidate during the
  checklist phase, we mute outbound video/audio to the others — but we don't
  log who was active when. Required for compliance audits ("did proctor X
  actually verify candidate Y at time Z?").
- **Suggested:** emit `proctor.activeChange` event from the gateway, persist
  to a new `ProctorAttentionLog` table.
- **Effort:** ~2 hours (schema + migration + emit + read endpoint).

### G5. Interview recording is not actually stored
- **Backend:** Interview model has a `recordingPath` field but nothing writes
  to it. The proctor flow has a `RecordingsService` for MCQ exams but
  interview rooms don't hook into it.
- **Suggested:** add `RecordingsService.startInterview(interviewId)` mirror
  of the exam path, persist chunks every ~5s.
- **Effort:** ~3 hours.

---

## Medium-impact gaps

### G6. No "candidate is connected" indicator to HR before they open the room
- HR can see status `SCHEDULED / IN_PROGRESS` but not whether the candidate
  is actually waiting in the room.
- **Suggested:** when candidate joins the magic-link page, emit
  `interview.candidatePresent` to HR's org channel.
- **Effort:** 1 hour.

### G7. No retry logic on Cloudflare TURN mint
- `TurnService.getIceServers()` calls Cloudflare once; if Cloudflare returns
  500, the cache stays empty for 23h.
- **Suggested:** on network/5xx error, retry once with 200ms backoff
  before returning the empty list.
- **Effort:** 20 min.

### G8. No frontend health-check page
- Operator has to run `curl /api/health` from a shell. No browser-accessible
  status page showing backend reachability + Cloudflare TURN minted ok +
  WS connected + media constraints check.
- **Suggested:** `/__status` route that runs a series of checks and
  renders pass/fail.
- **Effort:** ~1 hour.

### G9. Bulk candidate import / CSV upload
- HR can only add candidates one at a time. Realistic onboarding (50
  candidates per cohort) is painful.
- **Suggested:** `POST /candidates/import` accepting CSV; reuse existing
  `createCandidate` per row with chunked progress reporting.
- **Effort:** ~3 hours.

### G10. No timezone display on the HR scheduling view
- Slot is shown in HR's local browser time but the candidate sees their own
  timezone. Without an explicit "candidate sees this as X" indicator, HR
  can mis-schedule across timezones.
- **Suggested:** in the schedule modal, show both `HR_TZ → CANDIDATE_TZ`
  side-by-side.
- **Effort:** 30 min.

---

## Low-impact / nice-to-haves

### G11. No dark/light theme toggle (light theme exists in CSS but unused)
### G12. Missing PWA manifest for the candidate exam page (would help with kiosk-mode deployment)
### G13. No exportable session report PDF (only HTML view in portal)
### G14. No "test connection" button on the candidate's pre-exam screen — they enter the verification flow blind
### G15. Practical paper sets have no per-question time limit (only a global session limit)
### G16. Notification email templates are inlined in `notifications.service.ts` — no template files; hard to localise
### G17. No proctor "raise hand" → HR/supervisor escalation path
### G18. Interview verdict (HIRE/HOLD/NO_HIRE) is captured but not exposed in any analytics dashboard

---

## Doc / ops gaps

### O1. No deploy runbook in the repo
- The pull-build-restart sequence is scattered across chat history. Recreate as
  `docs/DEPLOY.md` with the standard PM2 + Apache routine, including the
  Cloudflare TURN env vars.

### O2. No `.env.example` for backend
- Onboarding a new dev requires copying a working `.env` from a teammate.
  Should ship a redacted template (`backend/.env.example`).

### O3. No Postgres backup script
- Currently DB backups are manual. Add a nightly `pg_dump` cron + S3 upload
  (or local rotation if S3 not available).

### O4. PM2 ecosystem file isn't in repo
- We restart by id (10) or name guesswork. A committed `ecosystem.config.js`
  with explicit app names + cwd + env_production blocks makes deploys
  reproducible.

### O5. No CHANGELOG or release tagging
- Hard to tell what shipped when. Add a basic `CHANGELOG.md` driven by
  conventional-commit messages.

---

## How to prioritise

If you have a one-day window, I'd order it:

1. G3 (CANDIDATE_ORG_MISMATCH UI) — finishes off the H4 fix, 20 min
2. G1 (Interview reschedule) — solves a real HR pain point, 1 hour
3. G2 (Atomic magic link verify) — security tightener, 30 min
4. O1 + O2 (Deploy runbook + .env.example) — saves future debugging, 1 hour
5. G6 (candidate-present indicator) — HR UX delight, 1 hour
6. G14 (candidate tech-check before verification) — reduces "I can't connect"
   support tickets, 1 hour

That's a focused ~5 hours of high-impact work.
