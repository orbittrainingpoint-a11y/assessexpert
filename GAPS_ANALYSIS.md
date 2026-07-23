# AssessExpert — Gaps Analysis

**Date:** 2026-07-23
**Method:** Direct source inspection + running-state validation. Every claim below is grounded in a specific file / line / DB state, not memory.
**Scope:** Security + feature + operational + technical debt + testing + documentation gaps as they exist **today** (post-sprint 3, post-user-management, post-DB-password-rotation).
**Intent:** Catalogue. No code changes. Pick the buckets you want to action.

---

## Severity legend

- **P0** — Exploitable in prod today, or blocks a customer-facing flow
- **P1** — Real risk / painful gap, fix this month
- **P2** — Hardening / DX / observability
- **P3** — Nice-to-fix / long-term

---

## 1. Security gaps

### 1.1 Secrets rotation — INCOMPLETE

| Secret | Status | Where | Action |
|---|---|---|---|
| DB password | ✅ ROTATED (2026-07-21) | `.env` DATABASE_URL | — |
| `JWT_SECRET` | ❌ Original value leaked in transcript | `.env` | **P0** — rotate now. Logs everyone out on restart. |
| `JWT_REFRESH_SECRET` | ❌ Original leaked | `.env` | **P0** — rotate with JWT_SECRET. |
| `SESSION_SECRET` | ❌ Still literally `"assessexpert-session-secret-change-in-production"` | `.env` | **P0** — never was strong. |
| `SMTP_PASS` (Gmail app pw) | ❌ Original leaked | `.env` | **P1** — someone can send email as `theassessexpert@gmail.com`. |
| `GEMINI_API_KEY` | ❌ Original leaked | `.env` | **P1** — GCP billing risk. |
| `JITSI_APP_SECRET` | ❌ Original leaked | `.env` | **P1** — video session tokens can be forged. |
| `CLOUDFLARE_TURN_API_TOKEN` | ❌ Original leaked | `.env` | **P1** — attacker can spin TURN sessions on your CF account. |

### 1.2 Authentication surface — DEFERRED (SAST P3 #17)

- **JWT still stored in `localStorage`** — `frontend/portal/lib/api.ts:10-13`. XSS anywhere would exfiltrate the access + refresh tokens. Mitigated by current lack of XSS surface (DOMPurify on every user-rendered string + `safeHref` allowlist), but the default is still wrong.
- **Cookie migration** — planned in `COOKIE_AUTH_PLAN.md`, awaiting your four approvals in §10 of that doc. Not started. **P2** (planned).

### 1.3 Missing account safety features

| Feature | Present? | Recommended |
|---|---|---|
| **Email verification on user creation** | ❌ | Add `emailVerifiedAt` field, block full access until verified. **P1**. |
| **Login rate limit per user (not just per IP)** | ❌ | Only global 10/min throttle + MFA has per-user lockout. Login itself doesn't. Attacker with distributed IPs can grind passwords. **P1**. |
| **Account lockout after failed logins** | ❌ | Should lock account for 15min after 5 failed attempts. **P1**. |
| **Password strength requirements beyond 8 chars** | ❌ | Currently only `length >= 8`. No complexity check. **P2**. |
| **Password history / no-reuse policy** | ❌ | User can immediately reset back to the same password. **P2**. |
| **Password expiry** | ❌ | Compliance requirement for some enterprise buyers. **P3**. |
| **MFA backup codes** | ❌ | If user loses their TOTP device, they're locked out permanently. **P1**. |
| **Session listing / manual revocation** | ❌ | User can't see "who is logged into my account right now" and boot them. **P2**. |
| **Login history / audit trail for user** | ❌ | `lastLoginAt` exists but no history table. **P2**. |
| **Device fingerprinting / anomaly detection** | ❌ | New-device email like GitHub / Google. **P3**. |

### 1.4 CSP still in report-only mode

- `frontend/portal/middleware.ts` emits `Content-Security-Policy-Report-Only`. Never flipped to enforcing.
- **P2** — set `CSP_REPORT_ONLY=false` after 2-week burn-in of violation reports. It's been 3+ weeks.

### 1.5 Missing DTOs on 13 controllers

- Per SAST P2 #15 catalogue, still `@Body() body: any` on: interviews, organizations, cms admin, practical-sets, practical-tasks, sessions, master-proctor settings.
- Every one is auth-gated so blast radius is limited to whichever role can hit it. Still hardening debt.
- **P2** — mechanical sweep, 1 day.

### 1.6 Public endpoints missing input validation depth

- `/auth/otp/send`, `/auth/otp/verify`, `/auth/magic-link/verify` — all take `@Body() body: { … }` typed but not `class-validator`-checked. Shape validation is manual/partial.
- **P2** — add DTOs alongside the SAST sweep.

### 1.7 Missing HTTPS-only cookie flags on candidate flow

- Magic-link candidate flow doesn't set any cookies today (stays in URL). If Sprint 4 cookie migration lands and inadvertently extends to candidates, the `SameSite=Strict` breaks the third-party context. Called out in `COOKIE_AUTH_PLAN.md` §1 explicitly — good; just noting so it doesn't drift.

### 1.8 Rate-limit coverage is uneven

Reviewed the 4 `@Throttle` decorators in the codebase:
- `/auth/*` — 10/min ✅
- `/turn/credentials` — 30/min ✅
- `/recordings/*`, `/facial-recognition/*` — 240/min (high but justified — high-frequency streaming)

**Missing throttles** on:
- `/users/*` (admin CRUD) — an internal admin could enumerate users at 1000/sec. Low priority.
- `/cms/public/*` — marketing site is public but there's no per-IP cap. Bot-scraping risk. **P2**.
- `/quiz/public/:token/*` — candidate flow. Not throttled — a compromised token could be replayed rapidly. **P2**.
- `/sales/leads` (contact form) — global throttle covers it but a dedicated stricter cap would help. **P3**.

---

## 2. Feature gaps (user-visible missing capabilities)

### 2.1 Admin — Users page

Recent commit `b8eaae0` added: Reactivate, Delete, Send-Reset-Link. Still missing:

| Feature | Present? | Priority |
|---|---|---|
| Show DELETED users in an audit view | ❌ | P2 |
| Edit user modal (not just create) | ❌ (backend `PUT /users/:id` exists but no UI trigger) | **P1** |
| Bulk import users via CSV | ❌ | P3 |
| Search by email exact-match | ⚠️ (only fuzzy contains) | P3 |
| Filter by organization | ❌ (only role filter) | P2 |
| Show MFA enabled/disabled column | ❌ | P2 |
| Force-logout all sessions for a user | ❌ (no session table exists) | P2 |
| See invitation status (sent / expired) | ❌ | P1 |

### 2.2 Admin — Assessment Types

Recent commit added Activate/Archive. Still missing:

| Feature | Present? | Priority |
|---|---|---|
| Edit modal for an existing assessment type | ❌ | **P1** — the field values are locked once created |
| Duplicate assessment type as starting point | ❌ | P2 |
| See which sessions used a given type before archive | ❌ | P2 |
| Preview candidate experience | ❌ | P3 |

### 2.3 HR — Candidates

| Feature | Present? | Priority |
|---|---|---|
| Bulk import CSV | ✅ | — |
| Bulk delete | ❌ | P2 |
| Bulk invite to assessment | ❌ | P2 |
| Export shortlist to CSV/PDF | ❌ | **P1** — GDPR data-portability requirement |
| Search across custom `extraFields` | ❌ | P3 |
| Candidate tags for pipeline management | ❌ | P3 |
| Notes / comments per candidate | ⚠️ (single `notes` string field) | P3 |

### 2.4 Master Proctor / Exam Setup — Questions

| Feature | Present? | Priority |
|---|---|---|
| Bulk import CSV / XLSX | ✅ | — |
| Bulk-activate drafts | ✅ | — |
| Export question bank | ❌ | **P1** — customer request for compliance |
| Search within question text | ❌ | P2 |
| Duplicate question | ❌ | P2 |
| Question versioning / history | ⚠️ (`version` field exists but no UI) | P3 |
| Rich text / image in question | ⚠️ (image upload exists but layout limited) | P3 |
| Preview how question renders to candidate | ❌ | P2 |

### 2.5 Proctor — Session

| Feature | Present? | Priority |
|---|---|---|
| Multi-candidate proctor view | ✅ | — |
| Live face capture display | ✅ | — |
| Session chat with candidate | ❌ | **P1** — proctor can't clarify a question |
| Manual escalation / flag | ⚠️ (partial) | P2 |
| Session transfer to another proctor | ❌ | P2 |
| Second-opinion request on borderline | ❌ | P3 |

### 2.6 Reports

| Feature | Present? | Priority |
|---|---|---|
| PDF export | ✅ | — |
| Report signing / attestation | ❌ | **P1** — regulated industries need this |
| Report versioning after edit | ❌ | P2 |
| Share report with external URL (token-gated) | ❌ | P2 |
| Aggregate reporting across candidates | ❌ | P2 |
| ATS integration webhook | ❌ | P2 |

### 2.7 Candidate experience

| Feature | Present? | Priority |
|---|---|---|
| Mobile responsive exam UI | ⚠️ (works but not optimised) | P2 |
| Accessibility: keyboard navigation | ⚠️ (partial) | **P1** — WCAG requirement |
| Screen reader support | ❌ | P1 — WCAG |
| Language selection at start | ❌ (relies on browser) | P2 |
| Save progress on network drop | ⚠️ (auto-save exists but not seamless) | P2 |
| Post-exam feedback survey | ❌ | P3 |

### 2.8 Sales — Contact form

Recent commit split into `SalesPublicController`. Still missing:

| Feature | Present? | Priority |
|---|---|---|
| CAPTCHA / bot protection on public form | ❌ | **P1** — spam risk once site starts ranking |
| Auto-reply email to submitter | ❌ | P2 |
| Slack / Teams webhook on new lead | ❌ | P2 |
| Lead scoring | ❌ | P3 |

---

## 3. Operational gaps

### 3.1 Deploy / infra

| Gap | Priority |
|---|---|
| **pm2 daemon out of date** — 6.0.14 running, 7.0.1 installed. Every restart prints a nag banner. `pm2 update` once fixes it. | P2 |
| **Root-level stray `/var/www/html/assessexpert/package-lock.json`** — confuses Next.js Turbopack, prints warning every build. Delete it. | P3 |
| **`backend/package-lock.json` Linux regen still pending** — every VPS deploy needs `npm install` (not `ci`) because the checked-in lockfile was regenerated on Windows. Ideal fix: run `rm -rf node_modules package-lock.json && npm install` on a Linux box once, commit that lockfile. Then `npm ci` works everywhere. | P2 |
| **Merge-conflict-prone `.env`-adjacent workflow** — VPS's local edits to `backend/package.json` block pulls. Root cause: no `.gitignore` on the local-only patches. | P3 |
| **No blue-green / staging environment** — every change lands directly in prod. Deploys are single-node with a manual restart. | **P1** |
| **No automated deployment (CI/CD)** — every deploy is `git pull && build && pm2 restart` by hand. Human step means human error (see: last three deploys). | **P1** |
| **No rollback tooling beyond `git checkout <hash>`** — should have a scripted "roll back to last known good" that also rolls the migration if needed. | P2 |

### 3.2 Monitoring / observability

| Gap | Priority |
|---|---|
| **No error monitoring (Sentry / Rollbar)** — pm2 logs are the only visibility. Errors that don't crash the process are invisible unless someone tails logs. | **P0** for production hygiene |
| **No metrics endpoint / dashboard** — no Prometheus / Grafana / OpenTelemetry. No visibility into request rate, latency, error rate, memory trend. | **P1** |
| **No uptime monitoring** — no external ping that alerts if `/api/health` starts 5xx-ing. | **P1** |
| **No structured logging** — 87 `console.log` calls across backend, most string-concatenated. Not JSON, not grep-friendly. | P2 |
| **No log aggregation** — pm2 logs stay on the VPS. If the box dies, logs die with it. | P2 |
| **No slow-query monitoring** — Prisma has slow-query logging capability, not enabled. | P2 |

### 3.3 Backups

| Gap | Priority |
|---|---|
| **`backup-db.sh` exists** — is it scheduled? Unverified from here. Need cron entry check. | **P0** if not scheduled |
| **Off-VPS backup destination** — script probably writes locally. If the VPS dies, the DB and its backups die together. | **P0** |
| **Recording / practical-file backup** — uploaded practical submissions live in `./storage/`. Not obviously backed up. | **P1** |
| **Restore drill** — has the backup ever been restored to verify it works? Testing restores is the only way to know they work. | **P1** |

### 3.4 Cost / vendor risk

| Gap | Priority |
|---|---|
| **Gmail SMTP** — free tier, aggressive rate limits (500 emails/day). If a bulk-hiring campaign fires 200 candidate invites at once, half will queue and delay. | P2 |
| **Gemini API** — no cost cap set. A runaway prompt loop could burn thousands of dollars overnight. | **P1** |
| **Cloudflare TURN** — usage-based billing, no cap visibility in our code. | P2 |
| **No status page** — customers can't see if we're up or degraded. | P3 |

---

## 4. Technical debt (structural code issues)

### 4.1 Numeric snapshot

| Metric | Value | Change since analysis |
|---|---|---|
| `@Body() body: any` in controllers | **13** | unchanged since SAST P2 |
| `as any` casts (excl. tests) | **85** | ↓ from 92 (SAST P3 sweep touched 6) |
| `console.log/warn/error` calls | **87** | unchanged |
| `TODO` / `FIXME` / `HACK` | 1 | unchanged (auto-capture.service.ts:420) |
| Backend unit tests | **28 passing** | unchanged |
| Backend spec files | 3 (audit, notifications, quiz) | unchanged |
| Playwright specs | 4 scaffolded | mostly empty |

### 4.2 File-size hot spots

| File | LOC | Comment |
|---|---|---|
| `frontend/portal/app/exam/page.tsx` | ~1,450 | State machine + 4 phases + camera + MediaPipe + ChecklistPanel. **P1 refactor candidate.** |
| `backend/src/modules/quiz/quiz.service.ts` | ~775 | OTP + grading + PDF + report listing. **P2**. |
| `backend/src/modules/sessions/sessions.service.ts` | ~708 | Session lifecycle scattered. **P2**. |

### 4.3 Deprecation warnings

- Next.js 16.2.4: `middleware.ts` deprecated in favour of `proxy.ts`. Warning on every build. **P2** — rename in Sprint 5.
- npm audit: **62 vulnerabilities** in transitive deps (44 moderate, 15 high, 3 low). Almost all unreachable given our usage patterns; documented in `CODEBASE_ANALYSIS.md` §1. Real ones: `next` DoS CVE — patch bump held pending. **P1**.

### 4.4 Missing patterns

- No **eslint rule** enforcing `no-explicit-any` — the `as any` count will creep back up.
- No **typed Prisma enums** import convention — 85 `as any` casts include enum type-punning.
- No **domain error classes** — all errors are generic Nest HttpException subclasses. No structured error codes for the frontend to switch on.
- No **request ID propagation** — tracing a request across services is manual.

---

## 5. Testing gaps

### 5.1 Backend

**28 unit tests, 3 spec files.** ~120 source files. Coverage estimate: **<10%**.

Untested critical paths:
- Auth flow (login / MFA / refresh / logout)
- Password reset flow (just landed — zero tests)
- User lifecycle (reactivate / delete)
- Tenant isolation (org boundary enforcement)
- Scheduling / slot grouping
- Practical set auto-assignment
- Sessions state machine
- Report generation
- Every controller's DTO validation
- CMS content flow

### 5.2 Frontend

**No unit tests at all.** No React Testing Library, no Vitest, no Jest for the frontend.

### 5.3 End-to-end (Playwright)

- 4 scaffolded spec files under `e2e/tests/`
- Never run as part of CI (no CI exists)
- Coverage: login smoke + a few marketing page renders

**Missing critical E2E:**
- Full candidate proctored exam flow
- Quiz flow (candidate perspective)
- HR schedule candidate → invitation → candidate opens link → completes → report visible
- Admin creates assessment type → questions → activate → HR schedules
- Password reset end-to-end (email link → new password → login)

### 5.4 Load / performance testing

- No load tests
- No baseline for concurrent user capacity
- No capacity planning documentation

---

## 6. Documentation gaps

### 6.1 What exists (recent work)

- `SAST_REPORT.md` — security findings catalogue ✅
- `CODEBASE_ANALYSIS.md` — engineering health ✅
- `COOKIE_AUTH_PLAN.md` — cookie migration plan ✅
- `MCQ_IMPORT_FORMAT.md` — CSV format reference ✅
- `DEPLOY.md` — deploy instructions ✅
- `frontend/portal/AGENTS.md` — Next 16 warning ✅

### 6.2 What's missing

| Doc | Priority |
|---|---|
| **`RUNBOOK.md`** — how to handle common incidents (backend crash-loop, DB down, migration fails, email not sending, etc.) | **P1** |
| **`SECRETS_MANAGEMENT.md`** — how to rotate each secret, what breaks when you do, order to rotate in | **P1** |
| **`API.md`** or hosted Swagger spec on a stable URL | P2 |
| **`ARCHITECTURE.md`** — request lifecycle, module map, data flow diagrams for new devs | P2 |
| **`ONBOARDING.md`** — first-day setup for a new developer | P2 |
| **`CUSTOMER_SUPPORT_PLAYBOOK.md`** — "user reports they can't log in" → what to check, in order | P2 |
| **Model / entity diagram** — Prisma has one generatable via `prisma-erd-generator` | P3 |
| **`CHANGELOG.md`** — user-facing release notes, distinct from git log | P3 |

---

## 7. Compliance / legal gaps

| Gap | Priority |
|---|---|
| **GDPR — data export** — user has right to request all their data. No self-service export. | **P1** |
| **GDPR — right to erasure** — partial (candidates.service has a `purgeCandidate` endpoint). Users don't have equivalent for their own account. | **P1** |
| **GDPR — data processing agreement** — needed for enterprise buyers. Legal doc, not code. | P1 |
| **Privacy policy** — currently rendered from a CMS row (verified in exam/page.tsx). Text exists, unclear if reviewed by legal. | P2 |
| **Terms of service** — same. | P2 |
| **Cookie consent banner** — required in EU. Not present. | **P1** |
| **Data retention policy enforcement** — `RECORDING_RETENTION_DAYS=7` env var exists. Is it enforced by a job? Unverified. | **P1** |
| **Audit log retention** — no defined policy. Rows accumulate indefinitely. | P2 |
| **SOC 2 / ISO 27001 readiness** — depends on above + change-management process. | P2 |

---

## 8. Cross-reference to older catalogues

| Doc | Status |
|---|---|
| `SAST_REPORT.md` | P0/P1/P2 all closed except cookie auth (P3 #17) |
| `CODEBASE_ANALYSIS.md` §11 | Sprints 1-3 done, Sprint 4 planned, 5-6 pending |
| `COOKIE_AUTH_PLAN.md` §10 | Awaiting your 4 approvals |
| `MCQ_IMPORT_FORMAT.md` | Current + accurate |

---

## 9. Prioritised action list (what I'd do first)

Top 10 items to action next, in rough order of leverage:

1. **P0 — Rotate remaining secrets** (JWT, JWT_REFRESH, SESSION, SMTP, Gemini, Jitsi, CF TURN). 15 minutes with the runbook I gave you last message. Same-day.
2. **P0 — Verify DB backup is scheduled + working + off-VPS**. Not a code change; a cron-and-cloud task. Same-day.
3. **P0 — Wire Sentry** (or free-tier alternative) for backend error visibility. 1 hour.
4. **P1 — Uptime monitor** (UptimeRobot free tier / BetterStack). 15 minutes.
5. **P1 — GDPR endpoints**: user data export + user account deletion. 1 day.
6. **P1 — Account lockout after N failed logins** + email verification on user creation. Half a day.
7. **P1 — MFA backup codes** — the "MFA device lost" support-ticket avoider. Half a day.
8. **P1 — RUNBOOK.md + SECRETS_MANAGEMENT.md**. Half a day.
9. **P1 — Edit user modal on `/admin/users`** + invitation status column. Half a day.
10. **P1 — Playwright happy-path E2E** for proctored exam + quiz + password reset. 1 day.

---

## 10. What this document does NOT do

- Doesn't rank the P2/P3 items — plenty of latitude for what to pick up.
- Doesn't propose specific technical designs — those get their own `PLAN.md` when we execute.
- Doesn't include performance profiling — separate task, needs prod traffic traces.
- Doesn't second-guess earlier catalogued items (see §8) — refer to those.

---

## Summary — one paragraph

Product is materially shippable; the platform-security spine is closed (SAST P0/P1/P2 done). The two biggest classes of risk left are **operational** (no error monitoring, no CI/CD, no verified off-VPS backups) and **product completeness** (missing edit-user modal, missing GDPR endpoints, missing MFA backup codes, missing lockout, missing session listing). One remaining code-quality debt sprint (Sprint 5) covers the DTO + enum sweep. Long-term architectural piece is Sprint 4 cookie auth. Everything else is polish.
