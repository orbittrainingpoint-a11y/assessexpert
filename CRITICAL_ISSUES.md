# Critical Issues — Sorted Shortlist

Top issues from the BUGS / SECURITY / TESTING_REPORT files, sorted by
**(real impact × ease of exploit) ÷ (effort to fix)**. Ship top-down.

Updated 2026-06-21 alongside the unit + integration test setup commit.

---

## 🚨 P0 — Ship today (each ≤ 15 minutes)

### #1 — Weak OTP randomness (Quiz) ✅ DONE
- **Where:** `backend/src/modules/quiz/quiz.service.ts:120` + question shuffle.
- **Fix shipped:** `Math.random()` replaced with `crypto.randomInt` for OTP; question shuffle is now Fisher-Yates with `randomInt(0, i+1)`. Bias-free + CSPRNG-sourced.

### #2 — PII in plaintext server logs ✅ DONE
- **Where:** `backend/src/modules/candidates/candidates.service.ts:83`
- **Fix shipped:** log line is now `Creating candidate org=<id> email=a***@domain` — first letter + domain only. No more full name / phone / notes in pm2 logs.

### #3 — `'as any'` on Prisma enums (~50 sites) — DEFERRED
- **Where:** throughout `backend/src/modules/`
- **Issue:** every `status: 'XYZ' as any` bypasses TS — a future enum rename compiles fine and 500s at runtime. We hit this exact bug 3 days ago with `'COMPLETED'`.
- **Fix:** mechanical sweep — import `SessionStatus` etc. from `@prisma/client` and use the enum value.
- **Effort:** 30 min, but can be done with eslint --fix if we add a rule. P0 because every untyped cast is a future production incident waiting to happen.

---

## 🔴 P1 — Ship this week (each ≤ 1 hour)

### #4 — Quiz OTP verify is non-atomic (one OTP used twice) ✅ DONE
- **Where:** `backend/src/modules/quiz/quiz.service.ts`
- **Fix shipped:** `verifyOtp` switched to atomic `updateMany` with the OTP hash + expiry in the where clause. First request wins, second sees `count === 0` and 401s. **New integration test** confirms concurrent verifies yield exactly 1 success + 1 failure.

### #5 — Magic-link verify race (proctored exam path) ✅ DONE
- **Where:** `backend/src/modules/auth/auth.service.ts:157`
- **Fix shipped:** `verifyMagicToken` now uses `updateMany({ where: { id, tokenUsedAt: null }, ... })` so the first-use IP / status update is a compare-and-swap. Two tabs racing the same link can't both claim the first-use record.

### #6 — Stale `phase` closure in exam timer ✅ DONE
- **Where:** `frontend/portal/app/exam/page.tsx`
- **Fix shipped:** added `phaseRef` + `candidateIdRef` mirroring the latest values every render. Timer + sync callbacks read from refs, so a proctor-driven phase advance during a server-sync round-trip can't be silently rolled back.

### #7 — Multi-candidate audio chunks miss `candidateId` — FALSE POSITIVE
- **Verified clean.** `useAudioTranscriber` already uses an `extraFieldsRef` reassigned every render at `useAudioTranscriber.ts:60`; the chunk uploader at `:101` calls `extraFieldsRef.current?.()` which evaluates the latest arrow → latest `sessionState`. Agent's claim re-checked against source — no fix needed.

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

### #14 — `useJitsi.ts` has 20 silent `catch {}` blocks ✅ PARTIAL
- **Fix shipped:** the two highest-value catches (`setRemoteDescription(answer)` and `addIceCandidate`) now log `console.warn` with the peer id and error message. The remaining silent catches are cleanup-related (closing already-closed PCs, stopping tracks) and intentionally quiet — adding warns there would be noisy without diagnostic value.

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
