# Testing Report — 2026-06-20

Comprehensive audit of the AssessExpert platform. Combines automated
type-checks, parallel deep-scan reviews of backend + frontend, static
pattern matching, and a Playwright scaffold for future end-to-end runs.

Existing catalogs ([BUGS.md](BUGS.md), [GAPS.md](GAPS.md),
[SECURITY.md](SECURITY.md)) cover items already resolved. This file
lists NEW findings from today's audit + the test plan for going forward.

---

## What was actually run

| Test | Result | Notes |
|---|---|---|
| Backend `tsc --noEmit` | ✅ Pass | Clean |
| Frontend `tsc --noEmit` | ✅ Pass | Clean |
| Backend unit tests | ❌ Not present | No `*.spec.ts` files, no jest config |
| Frontend unit tests | ❌ Not present | No vitest/jest, no test scripts |
| E2E (Playwright) | ❌ Not present (until now) | Scaffolded in `/e2e` this commit |
| Static analysis (Grep patterns) | ✅ Run | Findings folded into the bug list below |
| Deep-scan code audit (parallel agents) | ✅ Run | 8 frontend + 7 backend findings, all triaged below |

The "testing pyramid" is empty below E2E. There are no unit, integration, or
contract tests in the repo. That's itself a high-priority gap — it means
every refactor is verified by hand, which is how we keep hitting
preventable issues like the `'COMPLETED'` enum bug from yesterday.

---

## 🔴 Critical — verified, ship fixes ASAP

### CR1. Quiz OTP verify is read-then-write — race lets one OTP be used twice
- **File:** `backend/src/modules/quiz/quiz.service.ts:148-169`
- **Verified by me.** I wrote this code; the read + update of `quizOtpHash` are two separate Prisma calls. Two concurrent requests can both read the hash, both pass the check, both update to null. The same code can be used to verify twice.
- **Real-world failure:** a candidate who screenshares their OTP screen during the (otherwise legitimate) quiz can let a second device verify before the first commits.
- **Fix (~20 min):** atomic `updateMany({ where: { magicToken, quizOtpHash: providedHash, quizOtpExpiresAt: { gt: new Date() } }, data: { quizOtpHash: null, quizOtpExpiresAt: null, tokenUsedAt: new Date() } })` and check `result.count === 1`.
- **Why deferred:** touches the auth-equivalent path for quiz — same caution as S5. Pair with G2 in a hardening sprint.

### CR2. Weak OTP randomness — `Math.random()` instead of CSPRNG
- **File:** `backend/src/modules/quiz/quiz.service.ts:120` and `:203`
- **Verified.** Line 120 generates a 6-digit quiz OTP from `Math.random()`. Line 203 shuffles questions the same way.
- **Real-world failure:** brute-force the OTP space (1M values) at the throttle ceiling — combined with CR1, an attacker can spam concurrent attempts and statistically hit a valid OTP.
- **Fix (~10 min):**
  ```ts
  import { randomInt } from 'crypto';
  const otp = String(randomInt(100000, 1000000));
  ```
  Shuffle can use Fisher-Yates with `randomInt(0, i+1)` for the same reason — quiz fairness can be gamed by anyone who can predict the seed.
- **Why ship now:** trivial change, zero blast radius, eliminates two real attack surfaces at once.

### CR3. Magic-link verify race (recap of S5 / G2 — still open)
- **File:** `backend/src/modules/exam-delivery/exam-delivery.service.ts`
- **Verified previously.** Same shape as CR1 but on the proctored exam path. Two browser tabs racing the same magic link can both succeed.
- **Status:** already in BUGS.md C3 + GAPS.md G2 + SECURITY.md S5 — not new, just acknowledged here for completeness.

---

## 🟠 High — verified or high-confidence

### HG1. PII logged in plaintext on candidate create
- **File:** `backend/src/modules/candidates/candidates.service.ts:83`
- **Verified by spot-check.** The service `Logger.log(JSON.stringify({ ...data, organizationId }))` writes first name, last name, email, phone, notes to the application log on every candidate create.
- **Real-world failure:** GDPR/CCPA exposure if logs ship to a third-party SaaS (CloudWatch, Datadog, Logtail) without scrubbing, or if logs are readable by contractors who don't have DSAR access.
- **Fix (~5 min):** log only `id`, `email` masked to `first-char + @domain`, and `organizationId`. Drop the rest.

### HG2. Stale `phase` closure in exam timer — proctor's manual phase advance can be overwritten
- **File:** `frontend/portal/app/exam/page.tsx:352-388`
- **Reported by frontend audit agent — verify before fixing.** The timer's `setTimeRemaining` updater reads `phase` from the closure, with `eslint-disable-next-line` explicitly suppressing the dep warning. If the proctor advances the candidate from `mcq` to `practical` mid-exam, the timer can still call `setPhase('mcq-complete')` when it fires and revert the proctor's action.
- **Failure mode:** rare, but when it hits, the exam appears to roll back to MCQ for the candidate — high-confusion event.
- **Fix:** store `phase` in a ref updated every render, read from the ref inside the callback.

### HG3. Speech recognizer auto-restart leaks after `enabled` flips
- **File:** `frontend/portal/lib/useSpeechTranscription.ts:83-88`
- **Reported by frontend audit agent.** `onend` handler captures `enabled` at effect-setup time. Flipping `enabled=false` while running doesn't stop the auto-restart loop — the orphaned `SpeechRecognition` keeps consuming microphone + CPU.
- **Failure mode:** mic stuck in "listening" state after the candidate exits verification; weird Chrome indicator stays on.
- **Fix:** mirror the `enabled` prop in a ref, check `enabledRef.current` in `onend`.

### HG4. First audio chunks uploaded without `candidateId` in multi-candidate slots
- **File:** `frontend/portal/lib/useAudioTranscriber.ts` + `frontend/portal/app/exam/page.tsx:486`
- **Reported by frontend audit agent.** The `extraFields: () => ({ candidateId: sessionState?.candidate?.id })` arrow captures `sessionState` at the effect's first run. If audio recording starts before OTP resolves the candidate id, those chunks land with `candidateId: undefined`.
- **Failure mode:** silent data-integrity loss — the proctor can't tell who said the first 30s of audio in a multi-candidate slot.
- **Fix:** read from a ref OR include `extraFields` in the effect's dep array.

### HG5. SessionRecorder loses final chunks on cleanup race
- **File:** `frontend/portal/lib/useSessionRecorder.ts:119-132`
- **Reported by frontend audit agent.** Cleanup sets `stopped = true` and fires the finalize POST in parallel; `ondataavailable` callbacks that fire after `stopped = true` are dropped silently.
- **Failure mode:** the last few seconds of the candidate's webcam recording are missing — invisible to HR until they review a clip and notice an abrupt cut.
- **Fix:** call `rec.requestData()` and await any in-flight upload before posting the finalize.

### HG6. (Repeated from earlier batch) Audit log already lands these — no test
- **Status:** S12 (`AuditLogInterceptor`) already ships. But the interceptor itself isn't unit-tested. If we break the redact list, sensitive payloads land in `AuditLog` rows. Add a focused unit test as part of the first jest setup.

---

## 🟡 Medium — claims that need verification before fixing

### M-A. "Backend bug #2 — `'COMPLETED'` SessionStatus usage in sessions.service.ts" — **FALSE POSITIVE**
- The audit agent flagged this as a critical enum mismatch, but verification shows those references are against `CandidateSessionStatus`, which DOES have `COMPLETED`. Lines 104, 167, 173, 435, 572 are correct. The agent confused `ExamSession.status` (the enum we hit yesterday) with `SessionCandidate.status`.
- **Status:** verified clean, no action.

### M-B. "Cross-tenant mutation in candidates.service.updateCandidate" (Backend Security #1)
- Agent claims the update doesn't filter by `organizationId`. **Needs verification** — `updateCandidate` may already use `getCandidate(id, orgId)` upstream, which throws on mismatch. If so, the update inherits the check.
- **Action:** read `updateCandidate` end-to-end before fixing. If the agent is right, change the update to filter by compound `(id, organizationId)`.

### M-C. Socket event handler accumulation in `useJitsi` on reconnect
- **File:** `frontend/portal/lib/useJitsi.ts:615-645`
- Agent claims handlers can double-attach if `enabled` flips true→false→true. Plausible but not yet observed. Verify by adding a console.log in the attach block and watching for duplicates during a flaky network test.

### M-D. N+1 in `sessions.service.completeMcq` candidate aggregation
- **File:** `backend/src/modules/sessions/sessions.service.ts:428-439`
- Agent claims O(n) JS loops on a multi-candidate slot finalize check. True for the common path but not actually N+1 (no per-row query). Performance worst-case is "iterate 50 cached objects" — not a real production hotspot today.
- **Fix priority:** low. Convert to `count()` when we have a >100-candidate slot in production.

### M-E. `Math.random()` for question shuffle
- **File:** `backend/src/modules/quiz/quiz.service.ts:203`
- Same root cause as CR2. Fix with the same `randomInt` swap.

---

## 🟢 Low / observed-only

### L1. Many `'as any'` casts on Prisma enum fields
- ~50 occurrences across the backend. Each one bypasses type checking — a future schema rename will compile fine and fail at runtime (exactly how we hit yesterday's `'COMPLETED'` bug).
- **Fix:** import the generated Prisma enums (`SessionStatus.MCQ_IN_PROGRESS`) and drop the cast. Mechanical, can be done in one pass with `eslint --fix` + a custom rule.

### L2. `setError(...)` calls in useJitsi never displayed
- `setError` is called in ~20 catch blocks but the rendered UI doesn't show the error string anywhere — it's stored in state but the component returns `null` for unrelated reasons. Either render an error banner or remove the setError calls.

### L3. Hardcoded `localhost:4000` fallback in `lib/useJitsi.ts`
- Production-safe today because the env var is always set, but if the env file ever clears, the candidate page silently posts to localhost. Tighten: throw on startup if `NEXT_PUBLIC_WS_URL` is missing in production.

---

## What's covered by the new Playwright scaffold

Created in this commit under `e2e/`:

| Spec | Coverage |
|---|---|
| `smoke.spec.ts` | Homepage, login form, /status, invalid-token graceful errors. **No seed data needed.** |
| `hr-login.spec.ts` | HR login, role-appropriate sidebar, logout. Needs `E2E_HR_EMAIL` / `E2E_HR_PASSWORD`. |
| `hr-schedule.spec.ts` | Scheduling modal renders, quiz toggle visibility depends on feature flag. Needs a seeded candidate. |
| `quiz-flow.spec.ts` | Candidate quiz: intro → email → OTP (rejected) → email-mismatch rejected. Needs `E2E_QUIZ_TOKEN`. |

See `e2e/README.md` for setup.

To run:
```bash
cd e2e
npm install
npm run install:browsers
npm test
```

---

## Manual test plan (for things Playwright can't easily reach)

These need a real second device + real cameras. Once a quarter or after
any change to `useJitsi.ts`, work through these:

### TP1. Proctored exam end-to-end (single candidate)
1. HR schedules a proctored exam for a candidate
2. Candidate opens magic link → OTP → camera → verification → MCQ → submit
3. Proctor opens the session → all 10 checklist items work, FR auto-captures
4. MCQ shows real-time answer progress in proctor view
5. Submit → report appears in HR's list

### TP2. Multi-candidate proctored exam
1. HR schedules 3 candidates into the same slot
2. All three open the link simultaneously
3. Proctor sees 3 tiles, can switch active candidate
4. Switching mutes audio/video to the non-active candidates (verify in `chrome://webrtc-internals`)
5. Each candidate's MCQ answers attribute to their own report

### TP3. HR interview lifecycle
1. HR schedules an interview → candidate receives email
2. Candidate clicks link → consent → permission → waits
3. HR opens the interview room → video + audio flow both ways
4. Auto-FR every 30s shows verdict
5. HR ends → marks recommendation → interview row closes out

### TP4. Quiz mode full flow
1. Super-admin enables quiz for the org
2. HR schedules a quiz → candidate gets email
3. Candidate clicks link → confirms email → enters OTP → answers all questions → submits
4. Candidate sees only "Thank you" (no score visible)
5. HR opens Quiz Reports → row appears with the candidate's name, score, per-domain
6. Click PDF → branded PDF downloads with Q&A

### TP5. Cloudflare TURN bypass
1. Candidate joins from a network that blocks UDP 3478/5349 (mobile hotspot is a good proxy)
2. Open `chrome://webrtc-internals` during the call
3. Verify a `relay` candidate with address in `162.159.*.*` (Cloudflare range)
4. Audio + video flows both ways

### TP6. Cross-org isolation
1. HR account in Org A
2. Try to GET `/api/candidates/<id-from-org-B>` via DevTools console
3. Expect 403 `CANDIDATE_ORG_MISMATCH`
4. Try same for sessions, reports, interviews

---

## Recommended next steps (priority ordered)

1. **Ship CR2** (CSPRNG OTP) today — 10 min, eliminates one attack surface
2. **Ship HG1** (PII log scrub) today — 5 min, removes GDPR exposure
3. **Branch a hardening sprint** for CR1, CR3 (atomic magic-link/OTP verify), HG2-5 (React lifecycle bugs). 1 day of focused work + verification.
4. **Set up Jest in `backend/`** with a few targeted unit tests for the redact list, score calculation, branding lookup. Pays for itself the first time it catches a regression.
5. **Run the Playwright scaffold** against staging — 5 min — and get the smoke tests in CI before any further deploy.
6. **Run TP1-TP4 manually** before the next release.

---

## Methodology

This audit was done by:
- Static analysis (Grep patterns for `Math.random`, `as any`, `catch {}`, missing await, etc.)
- Two parallel deep-scan agents (one backend, one frontend) each reading the actual files and reporting findings
- Verification of the highest-impact claims by reading the source directly
- Building a runnable Playwright scaffold from scratch (no test infra existed before this commit)

Items I personally verified are tagged as "Verified". Items reported by
the agents I haven't independently confirmed are tagged "Needs
verification" and should be checked before any fix is applied.
