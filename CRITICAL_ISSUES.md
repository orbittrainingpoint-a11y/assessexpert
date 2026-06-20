# Critical Issues — Sorted Shortlist

Top issues from the BUGS / SECURITY / TESTING_REPORT files, sorted by
**(real impact × ease of exploit) ÷ (effort to fix)**. Ship top-down.

Updated 2026-06-21 alongside the unit + integration test setup commit.

---

## 🚨 P0 — Ship today (each ≤ 15 minutes)

### #1 — Weak OTP randomness (Quiz)
- **Where:** `backend/src/modules/quiz/quiz.service.ts:120` (and `:203`)
- **Issue:** `Math.random()` for the 6-digit quiz OTP. Brute-forceable in 10 min under throttle ceiling.
- **Fix:**
  ```ts
  import { randomInt } from 'crypto';
  const otp = String(randomInt(100000, 1000000));
  ```
  Same fix for question shuffle: replace `.sort(() => Math.random() - 0.5)` with a Fisher-Yates that uses `randomInt`.
- **Effort:** 10 min. Touches one file. Zero blast radius — pure swap.
- **Why P0:** trivial, removes a real attack surface, no migration.

### #2 — PII in plaintext server logs
- **Where:** `backend/src/modules/candidates/candidates.service.ts:83`
- **Issue:** `Logger.log(JSON.stringify({ ...data, organizationId }))` writes first/last name, email, phone, notes on every candidate create. Leaks to any logging sink (CloudWatch, Datadog, contractor with log read).
- **Fix:** log `{ id, orgId, email: 'a***@domain' }` only.
- **Effort:** 5 min. One-line change.
- **Why P0:** GDPR/CCPA exposure, trivial fix.

### #3 — `'as any'` on Prisma enums (~50 sites)
- **Where:** throughout `backend/src/modules/`
- **Issue:** every `status: 'XYZ' as any` bypasses TS — a future enum rename compiles fine and 500s at runtime. We hit this exact bug 3 days ago with `'COMPLETED'`.
- **Fix:** mechanical sweep — import `SessionStatus` etc. from `@prisma/client` and use the enum value.
- **Effort:** 30 min, but can be done with eslint --fix if we add a rule. P0 because every untyped cast is a future production incident waiting to happen.

---

## 🔴 P1 — Ship this week (each ≤ 1 hour)

### #4 — Quiz OTP verify is non-atomic (one OTP used twice)
- **Where:** `backend/src/modules/quiz/quiz.service.ts:148-169`
- **Issue:** read-then-write on `quizOtpHash`. Two concurrent verify calls can both succeed.
- **Fix:**
  ```ts
  const result = await prisma.examSession.updateMany({
    where: { magicToken, quizOtpHash: providedHash, quizOtpExpiresAt: { gt: new Date() } },
    data: { quizOtpHash: null, quizOtpExpiresAt: null, tokenUsedAt: new Date() },
  });
  if (result.count !== 1) throw new UnauthorizedException(...);
  ```
- **Effort:** 30 min including a unit test against the new path.
- **Why P1:** auth-equivalent path. Same shape as the magic-link race (#5).

### #5 — Magic-link verify race (proctored exam path)
- **Where:** `backend/src/modules/exam-delivery/exam-delivery.service.ts` (and `auth.service.ts:157`)
- **Issue:** same shape as #4 but on the exam magic link. Two browser tabs racing the same link both succeed.
- **Fix:** same atomic `updateMany` pattern with `tokenUsedAt IS NULL` in the where.
- **Effort:** 45 min including verification with the integration suite.

### #6 — Stale `phase` closure in exam timer
- **Where:** `frontend/portal/app/exam/page.tsx:352-388`
- **Issue:** timer's `setPhase` callback reads `phase` from a stale closure (`eslint-disable-next-line` suppresses the warning). Proctor's manual phase advance can be silently overwritten when the timer fires.
- **Fix:** mirror `phase` in a ref updated every render; read `phaseRef.current` in the callback.
- **Effort:** 20 min.

### #7 — Multi-candidate audio chunks miss `candidateId`
- **Where:** `frontend/portal/lib/useAudioTranscriber.ts` + `app/exam/page.tsx:486`
- **Issue:** `extraFields: () => ({ candidateId: sessionState?.candidate?.id })` captures `sessionState` at effect-setup time. If audio recording starts before OTP resolves the id, the first ~30s of chunks land with `candidateId: undefined`.
- **Fix:** read from a ref, or add `extraFields` to the effect's dep array.
- **Effort:** 20 min.

---

## 🟠 P2 — Hardening sprint (each ≤ 3 hours, bundle them)

### #8 — Speech recognizer auto-restart leaks
- **Where:** `frontend/portal/lib/useSpeechTranscription.ts:83-88`
- **Issue:** `enabled` is captured in the `onend` handler; flipping `enabled=false` doesn't actually stop the recognizer. Mic + CPU keep running.
- **Fix:** ref-based `enabledRef.current` lookup inside `onend`.

### #9 — SessionRecorder loses last few seconds of video
- **Where:** `frontend/portal/lib/useSessionRecorder.ts:119-132`
- **Issue:** cleanup race — final chunks fire `ondataavailable` after `stopped=true` and get discarded; finalize POST is already in flight.
- **Fix:** call `rec.requestData()`, await in-flight uploads, then finalize.

### #10 — DTOs missing on public endpoints (auth, OTP, magic-link)
- **Where:** controllers under `backend/src/modules/{auth,quiz,exam-delivery}/`
- **Issue:** `@Body() body: any` everywhere. Lets malformed JSON crash deeper layers.
- **Fix:** introduce `class-validator` DTOs for the 5 highest-risk public POSTs. Frontend payloads need a parallel review.

### #11 — JWT in `localStorage` instead of `httpOnly` cookie
- **Where:** `frontend/portal/lib/api.ts` reads `localStorage.getItem('accessToken')`
- **Issue:** any XSS exfiltrates the token. With #12 still open, XSS surface is real.
- **Fix:** httpOnly + SameSite=Strict cookie + CSRF token. Big refactor — schedule as its own day.

### #12 — Next.js portal lacks Content-Security-Policy
- **Where:** middleware/headers config
- **Issue:** XSS or rogue extension can run unrestricted.
- **Fix:** ship in report-only mode for a week, then enforce. Pair with #11.

---

## 🟡 P3 — Routine cleanup (do whenever)

### #13 — File-upload audit-only mode currently logs but doesn't enforce
- Status: shipped earlier as audit-only (S8). After a week of pm2-log data, tighten the ceilings into actual rejection.

### #14 — `useJitsi.ts` has 20 silent `catch {}` blocks
- Each one swallows WebRTC errors. The user sees a black tile with no signal.
- Fix: add `console.warn` with context to each catch, OR surface via the existing `setError()` and render it.

### #15 — Frontend cache busts only on chunk-hash change
- After every deploy, users in open tabs see the OLD bundle until they hard-reload. We hit this 3× during debugging.
- Fix: build-time `<meta name="x-build">` + a polling effect that prompts "New version available — click to reload" when mismatched.

---

## Already shipped (recent) — for the change-log

- ✅ `SessionStatus.COMPLETED` enum mismatch fixed (used `REPORT_PUBLISHED`)
- ✅ Cloudflare TURN integration (firewall bypass for restrictive networks)
- ✅ Per-org branding + `quizEnabled` feature flag
- ✅ Quiz mode (MCQ-only, no camera, auto-published report, PDF export)
- ✅ Email plain-text fallback (deliverability SCL fix)
- ✅ HIRING_MANAGER could not read candidate (RBAC widening)
- ✅ Reschedule allowed from CHECKLIST/EXPIRED states
- ✅ 1080p camera capture + sender bitrate tune (with safe fallback)
- ✅ JWT secret length + distinctness enforced at boot
- ✅ `/turn/credentials` rate-limited (30/min/IP)
- ✅ `getSession` org param required
- ✅ Cross-org candidate returns `403 + CANDIDATE_ORG_MISMATCH` instead of 404
- ✅ Audit log interceptor on every mutation
- ✅ Upload-size audit logger
- ✅ Bulk CSV candidate import
- ✅ Logo white-chip render on dark UI
- ✅ Unit + integration test infra (this commit)

---

## Test coverage on the items above

| Item | Unit test | Integration test |
|---|---|---|
| Quiz grading (correctness) | ✅ `quiz.service.spec.ts` — 12 tests | ✅ `quiz-flow.int-spec.ts` — score, status transition, re-submit block |
| Quiz email confirm | — | ✅ `quiz-flow.int-spec.ts` — accepts real / rejects wrong |
| Audit log scrub list | ✅ `audit-log.interceptor.spec.ts` — 8 tests | — |
| Email plain-text fallback | ✅ `notifications.service.spec.ts` — 8 tests | — |
| Branding feature flag | — | ✅ `branding.int-spec.ts` — 3 tests covering flag flip |
| Magic-link race (#4 / #5) | ❌ | ❌ (would prove the bug; add before fix) |
| Stale phase closure (#6) | ❌ | ❌ (UI-level, needs Playwright) |
| Multi-candidate audio (#7) | ❌ | ❌ (UI-level, needs Playwright) |

Items without test coverage = anything you ship in P1 / P2 should land
with a regression test alongside it.

---

## How to run

```bash
# Unit tests (fast, no DB)
cd backend && npm test

# Integration tests (needs Postgres running with DATABASE_URL set)
cd backend && npm run test:int

# Everything
cd backend && npm run test:all

# With coverage
cd backend && npm run test:coverage

# E2E (Playwright, scaffolded in /e2e — see e2e/README.md)
cd e2e && npm install && npm run install:browsers && npm test
```

---

## Recommended order this week

1. Mon: ship #1, #2 (combined 15 min)
2. Tue: ship #3 (untype `as any` sweep) + #6 + #7
3. Wed: ship #4 + #5 (magic-link atomic verify) — pair them in one commit since they share the pattern
4. Thu: hardening session for #10 (DTOs)
5. Fri: schedule #11 + #12 for the following week's dedicated security day

The unit tests in this commit will catch any regression on the quiz
flow + audit log + plain-text email immediately. The integration tests
catch any contract break on branding / quiz endpoints.
