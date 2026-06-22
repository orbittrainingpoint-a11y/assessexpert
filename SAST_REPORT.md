# AssessExpert — SAST Report

**Date:** 2026-06-22
**Scope:** `backend/src/**` (NestJS + Prisma) and `frontend/portal/app/**` (Next.js 16). Static analysis only — no runtime exploitation. Findings verified by reading source at the cited line numbers; no false positives in the P0/P1 list.
**Method:** Direct pattern scans (CSPRNG misuse, raw SQL, dangerouslySetInnerHTML, child_process, hardcoded secrets) plus two parallel deep-analysis passes (auth/authz/IDOR, input validation/upload/public surface).

---

## Severity legend

- **P0** — Exploitable today; real data loss, cross-tenant leak, or privilege escalation.
- **P1** — Real risk, partially mitigated (auth gate, narrow conditions). Fix this sprint.
- **P2** — Hardening / defense-in-depth. Fix in a planned hardening sprint.
- **P3** — Nice-to-fix; minor noise.

Each finding lists: file:line · description · attack scenario · severity · whether existing tests would catch it. Items already documented in code comments as known-good are not repeated here.

---

## 🚨 P0 — Exploitable today

### #1 — Mass assignment on `User.createUser` ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/users/users.service.ts:66-79`
- **Issue:** Body fields spread directly into `prisma.user.create`. Only `password` is stripped. A caller (SUPER_ADMIN only) can pass `role: 'SUPER_ADMIN'`, `organizationId: '<any-tenant>'`, `mfaSecret: '<known>'`, `status: 'ACTIVE'` — all persist.
- **Attack:** Compromised SUPER_ADMIN account (or a buggy frontend that splays form state into the body) creates accounts with elevated roles in any org.
- **Tests catch it?** No. No test asserts that the response and DB state match an allowed-field list.
- **Fix:** Explicit allowlist of writable fields. Reject (or silently drop) anything else.

### #2 — Mass assignment on `User.updateUser` ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/users/users.service.ts:82-91`
- **Issue:** `data` spread directly into `prisma.user.update`. The `select` only controls the response — it does NOT filter writes. Same shape as #1.
- **Attack:** SUPER_ADMIN PUT `/users/:id` with `{ role: 'SUPER_ADMIN', organizationId: '<target>' }` escalates that user.
- **Tests catch it?** No.
- **Fix:** Same allowlist pattern as #1.

### #3 — Hardcoded fallback password on user create ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/users/users.service.ts:70`
- **Issue:** `await bcrypt.hash(data.password || 'TempPass123!', 12)` — any user created without an explicit password is bcrypted from a known string. Anyone who knows the default (it's in the codebase) can log in as that user.
- **Attack:** Admin creates user, forgets password field; user is logged in as via `TempPass123!`.
- **Tests catch it?** No.
- **Fix:** Reject `createUser` if no password and no invitation token. No fallback string.

### #4 — Mass assignment on `SessionCandidate.updateCandidateStatus` ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/sessions/sessions.service.ts:158-163`
- **Issue:** `data: { status, ...data }` — caller-controlled object spread into Prisma update. Caller is the proctor flow.
- **Attack:** Proctor passes `{ verifiedAt: '2026-01-01', mcqSubmittedAt: '2026-01-01', practicalScore: 100 }` and spoofs exam result timestamps and (potentially) scores.
- **Tests catch it?** No.
- **Fix:** Allowlist what status-transition data can update. Score/timestamp writes should go through dedicated methods (which they already do for the primary flow — this is the secondary unsafe overload).

### #5 — Path traversal in practical submission filename ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/exam-delivery/exam-delivery.controller.ts:185`
- **Issue:** `fileName = \`${Date.now()}-${file.originalname}\`` then `path.join(storagePath, fileName)`. If `originalname` contains `../`, `path.join` resolves the traversal — the `1234567890-` prefix does NOT block `..` segments.
- **Attack:** Candidate (post identity-verification) uploads a "practical submission" with `originalname = "../../../etc/foo"`. File written outside `./storage/practical-files`. Worst case: overwrite app code, config, or sibling tenant uploads.
- **Tests catch it?** No.
- **Fix:** Strip path separators and `..` from `originalname`; or use a UUID and ignore the original name entirely.

---

## 🔴 P1 — Real risk, fix this sprint

### #6 — Weak randomness for practical paper assignment ✅ FIXED IN THIS COMMIT
- **Where:** `backend/src/modules/practical-sets/practical-sets.service.ts:235`
- **Issue:** `sets[Math.floor(Math.random() * sets.length)]` — non-CSPRNG. A candidate who knows the set count and approximate timestamp could narrow down which paper they'll get.
- **Severity:** Lower than the quiz OTP (which we already fixed) because the practical set is randomised by the proctor, not the candidate. But for assessment integrity, predictability is a defect.
- **Fix:** `crypto.randomInt(0, sets.length)`.

### #7 — MFA verify lacks per-user rate limit
- **Where:** `backend/src/modules/auth/auth.service.ts:75-86`, `auth.controller.ts:28-32`
- **Issue:** TOTP verify only has the global throttle (10/min). An attacker with the userId can grind through TOTPs from many IPs.
- **Severity:** Mitigated by 6-digit TOTP key space × window=1 (so ~500k tries to guess), but a determined adversary with bot infrastructure could attempt it.
- **Fix:** Per-userId throttle (5 attempts / 15min sliding window). Lockout after N failures. Audit-log every attempt.

### #8 — `quiz/public/:token/submit` accepts unvalidated body
- **Where:** `backend/src/modules/quiz/quiz.controller.ts:75-78`
- **Issue:** `@Body() body: any` on the public quiz submission endpoint. No DTO. Service code path eventually validates the shape, but malformed input can throw deep in Prisma with verbose stack traces.
- **Severity:** Information disclosure via error messages plus DoS via malformed input.
- **Fix:** Add a `SubmitQuizDto` with class-validator.

### #9 — XLSX import — no formula-injection scrubbing on round-trip
- **Where:** `backend/src/modules/questions/questions.controller.ts` (parseImportFile via `XLSX.read`)
- **Issue:** XLSX import accepts user-supplied cells starting with `=`, `+`, `-`, `@`, `\t`. When a question containing such a cell is later exported (e.g., a CSV report) and opened in Excel, those become executable formulas. CVE class: CSV / spreadsheet formula injection.
- **Severity:** Indirect — only exploitable if the question text round-trips into a CSV download that a HR manager then opens in Excel.
- **Fix:** On import, prefix any field starting with `=+-@\t` with a single quote `'` (Excel's "treat as text" escape). Or sanitise on export.

### #10 — Invitation token error messages enable enumeration
- **Where:** `backend/src/modules/users/users.service.ts:287-299` + `users.controller.ts:15-17` (`GET /users/invitation/:token`)
- **Issue:** Distinct error messages for "invalid", "already accepted", "expired". Public endpoint, only global throttle.
- **Attack:** Attacker enumerates valid invitation tokens by checking error text.
- **Severity:** Mitigated by token entropy + 7-day expiry, but a leak.
- **Fix:** Single generic error message for all three failure modes. Log the actual reason server-side only.

### #11 — `practicalSubmissionUrl` rendered without protocol allowlist
- **Where:** `frontend/portal/app/(portal)/proctor/reports/[sessionId]/page.tsx:253`
- **Issue:** `<a href={session.practicalSubmissionUrl}>` — if a malicious actor ever wrote `javascript:alert(...)` into the DB column, the proctor's click executes it.
- **Severity:** Requires DB write capability, which limits the attack surface. Defense-in-depth fix.
- **Fix:** Wrap in a helper that asserts `href` starts with `/` or `http(s)://`.

---

## 🟠 P2 — Hardening sprint

### #12 — Audit log skips public mutations
- **Where:** `backend/src/common/interceptors/audit-log.interceptor.ts:47-52`
- **Issue:** Interceptor skips when `!req.user?.id`. Public mutations (invitation accept, magic-link verify, OTP send/verify) are never audited. Forensics gap.
- **Fix:** Emit audit rows for public mutations with `actor: 'PUBLIC'` and the request IP.

### #13 — `inviteUser` accepts `organizationId` from body
- **Where:** `backend/src/modules/users/users.service.ts:186-212`
- **Issue:** Service layer accepts `data.organizationId` and trusts it. Controller currently enforces org match but the service offers no second line of defense.
- **Fix:** Service should require `organizationId === inviter.organizationId` (or inviter is SUPER_ADMIN).

### #14 — Practical file upload size limit
- **Where:** `backend/src/modules/exam-delivery/exam-delivery.controller.ts` (FileInterceptor without size limit)
- **Issue:** Multer accepts arbitrarily large uploads. Storage exhaustion / DoS.
- **Fix:** Add `limits: { fileSize: 50 * 1024 * 1024 }` (or appropriate cap) to the FileInterceptor.

### #15 — `@Body() body: any` on most controllers
- **Where:** assessments, candidates, interviews, organizations, cms admin
- **Issue:** Generic input — no shape validation. Most are role-gated so the risk is reduced but the patterns drift over time.
- **Fix:** Class-validator DTOs on the 8-10 highest-traffic endpoints first.

---

## 🟡 P3 — Routine

### #16 — Repeated `as any` casts on enum values
- **Where:** ~50 sites across modules (e.g., `status: 'SCHEDULED' as any`)
- **Issue:** Bypasses TypeScript; a future enum rename compiles fine and 500s at runtime.
- **Fix:** Import Prisma enums (`SessionStatus`, `QuestionStatus`, etc.) and use the typed values. Add an eslint rule to prevent regression.

### #17 — JWT stored in `localStorage` (frontend)
- **Where:** `frontend/portal/lib/api.ts`
- **Issue:** XSS exfiltrates the access token. Mitigated by no XSS surface today (DOMPurify on every user-rendered string), but `localStorage` is the wrong default for tokens.
- **Fix:** Migrate to httpOnly + SameSite=Strict cookies + CSRF token. Significant refactor; schedule its own sprint.

### #18 — Next.js portal lacks CSP for the authenticated app
- **Where:** `frontend/portal/middleware` or `next.config.ts`
- **Issue:** Backend serves a strong CSP for API. The frontend's authenticated app surface (the portal under `(portal)`) does not advertise a CSP header in the response.
- **Fix:** Add CSP via Next.js middleware. Ship in report-only mode first.

---

## ✅ Verified clean — items the audit explicitly confirmed safe

- **No `eval()` / `new Function()` / `child_process`** anywhere in the backend source.
- **Single raw SQL query** in `admin.service.ts:63` — uses `Prisma.sql` parameterised templates. Safe.
- **All `dangerouslySetInnerHTML`** instances either sanitise via DOMPurify (blog, services, exam legal pages) or emit developer-controlled JSON-LD / chunk-reload scripts.
- **MIME validation** in `storage.service.ts:40-51` checks magic bytes, not the spoofable header.
- **Quiz OTP and question shuffle** already use `crypto.randomInt` (from the earlier P0 fix).
- **Audit log scrubs** `password`, `otp`, `token`, `imageBase64` — see `audit-log.interceptor.ts:35-39`.
- **CORS configuration** is env-driven with explicit origin allowlist; no wildcards.
- **Helmet + CSP** strong default on the API.
- **JWT bootstrap** refuses to start without ≥32-char secret that differs from the refresh secret.
- **TURN credentials** issuance is rate-limited (30/min/IP) — verified clean.
- **Cross-tenant candidate access** returns `403 + CANDIDATE_ORG_MISMATCH` (already hardened).

---

## What this commit ships

Fixes for **#1 through #6** land in this commit alongside this report. P1 items #7-#11 are written up for the next sprint; P2/P3 items are queued for the hardening sprint.

Total surface today:
- **5 P0s fixed** (mass-assignment ×3, hardcoded password, path traversal)
- **1 P1 fixed** (Math.random in practical assignment)
- **12 findings written up for the backlog** with file:line, severity, suggested fix
- **11 areas explicitly verified safe** (so future audits don't waste time re-checking them)
