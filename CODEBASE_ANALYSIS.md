# AssessExpert — Codebase Deep Analysis

**Generated:** 2026-06-23
**Scope:** `backend/src/` (NestJS 10 + Prisma 5) and `frontend/portal/` (Next.js 16 + React 19). 14,728 LOC backend, 21,479 LOC frontend.
**Method:** Direct inspection — `package.json` vs upstream, source-level pattern scans, code-smell grep, structural review.
**Intent:** This file is the **catalogue and prioritisation** — no code changes yet. Pick the buckets you want to action; each item is sized so the work is predictable.

---

## Severity legend

- **HIGH** — material risk if left (security drift, supply-chain CVE, performance cliff)
- **MEDIUM** — real value, no urgency. Schedule.
- **LOW** — cleanup / hygiene. Whenever.
- **SKIP** — flagged for awareness only; don't action unless context changes.

---

## 1. Framework + dependency status

### 1.1 Backend — NestJS 10 → consider 11 (or even 12)

| Package | Current | Latest stable (2026-Q2) | Δ | Severity | Notes |
|---|---|---|---|---|---|
| `@nestjs/common`, `core`, `platform-express` | **10.3.0** | **11.x** | 1 major | MEDIUM | NestJS 11 is the current LTS line. Migration is mostly non-breaking — small Reflector + Logger signature touch-ups, RxJS 7 stays. Coordinated bump across all `@nestjs/*` packages required. |
| `@nestjs/throttler` | 5.1.1 | 6.x | 1 major | MEDIUM | Bumps alongside core 11. Storage adapter API changed. |
| `@nestjs/swagger` | 7.3.0 | 8.x | 1 major | LOW | Decorator changes minimal; Swagger UI updates. |
| `@nestjs/jwt`, `passport` | 10.2.0 | 11.x | 1 major | MEDIUM | Goes with core 11. |
| `@nestjs/schedule` | 4.0.0 | 5.x | 1 major | LOW | Cron string format stable. |
| `@prisma/client`, `prisma` | **5.9.1** | **5.22+ / 6.x** | up to 1 major | MEDIUM | We're already on Prisma 5.22 generation (per the `postinstall` log). Pinned at 5.9.1 in package.json — a `prisma migrate` regen drift waiting to happen. Bump to 5.22 explicitly; consider 6.x in a separate sprint (breaking: full TypedSQL, no more `Json` shorthand). |
| `bcrypt` | 5.1.1 | 6.x | 1 major | LOW | API stable, native binding refresh. |
| `multer` | **1.4.5-lts.1** | **2.x** | 1 major | HIGH | Multer 1.x is **EOL with publicised CVEs**. npm-audit calls this out (form-data CRLF, etc.). Bumping to 2.x is the single highest-value backend dep update. |
| `puppeteer` | 22.1.0 | 24.x | 2 majors | MEDIUM | Used only for PDF generation in quiz + reports. Skips a release line that fixed Chromium sandbox CVEs. |
| `xlsx` | **0.18.5** | n/a (Sheetjs CDN-only since 2024) | — | HIGH | SheetJS migrated to a CDN-distributed model; the npm package version is pinned and vulnerable. Replace with `exceljs` or `node-xlsx` for the import path, or pin and accept the risk. |
| `aws-sdk` (v2) | 2.1551.0 | v3 modular | — | LOW | **Not imported anywhere.** Remove (see §3 dead deps). |
| `socket.io` | 4.7.4 | 4.8.x | minor | LOW | Patch-only bump. |
| `ioredis` | 5.3.2 | 5.4+ | minor | LOW | Patch bump. |
| `nodemailer` | 6.10.1 | 7.x | 1 major | LOW | Used in 3 services + a test script. v7 has cleaner OAuth2 but the SMTP path we use is unchanged. |
| `helmet` | 7.1.0 | 8.x | 1 major | LOW | CSP header generator changes. |
| `class-validator` | 0.14.1 | 0.14+ | patch | — | Current. |
| `class-transformer` | 0.5.1 | 0.5+ | — | — | Current. |
| `csv-parse` | 5.5.3 | 5.6+ | patch | LOW | — |
| `joi` | 17.12.1 | 17.13+ | patch | LOW | We barely use it (env validation only); could be removed in favour of Nest's `ConfigModule` schema. |
| `otplib` | 12.0.1 | 12.0+ | — | — | **Not imported.** See §3 dead deps. |
| `bull` + `@nestjs/bull` | 4.12.2 / 10.1.1 | BullMQ 5.x | — | — | **Not used.** No `@Processor`, no `BullModule`. Remove or wire up if queue work is planned. |
| `@tensorflow/tfjs-node` | 4.11.0 | 4.22+ | minor | MEDIUM | Used by facial-recognition. Native binding update fixes some glibc warnings on newer Ubuntu. |

### 1.2 Frontend — Next 16 + React 19 (current)

| Package | Current | Latest stable (2026-Q2) | Δ | Severity | Notes |
|---|---|---|---|---|---|
| `next` | **16.2.4** | 16.2.x patch (or 17 ?) | patch | MEDIUM | A Next.js Server-Components DoS CVE was patched in 16.2.x — verify we're on the latest 16.2 patch. SAST P1 reminded us; bumping to the latest 16.2 minor is a no-cost fix. |
| `react`, `react-dom` | **19.2.4** | 19.2+ | — | — | Current. React 20 not out yet. |
| `@tanstack/react-query` | 5.100.9 | 5.115+ | minor | LOW | Patch-only fixes. |
| `@tanstack/react-table` | 8.21.3 | 9.x | 1 major | SKIP | Used in only a handful of places; not worth a major bump for marginal gain. |
| `framer-motion` | 12.38.0 | 13.x | 1 major | LOW | Some breaking renames around `transition` defaults. Schedule alongside React Compiler eval. |
| `zod` | 4.4.3 | 4.5+ | minor | — (unused) | **Zero usage in the codebase.** See §3 dead deps. |
| `react-hook-form` | 7.75.0 | 7.80+ | minor | — (unused) | **Zero usage in the codebase.** See §3 dead deps. |
| `@hookform/resolvers` | 5.2.2 | 5.3+ | — | — (unused) | Goes with the above. |
| `isomorphic-dompurify` | 3.14.0 | 3.16+ | minor | LOW | Used by blog + service body sanitisation. |
| `axios` | 1.16.0 | 1.x patch | minor | LOW | — |
| `lucide-react` | 1.14.0 | 1.16+ | minor | LOW | Icon set additions only. |
| `date-fns` | 4.1.0 | 4.2+ | minor | LOW | — |
| `recharts` | 3.8.1 | 3.10+ | minor | LOW | — |
| `tailwindcss` | 4.x | 4.x | — | SKIP / DECIDE | We use Tailwind v4's PostCSS plugin but the UI is built with **inline styles** (~3,640 `style={{...}}` instances) plus custom `web-*` CSS classes. Tailwind is essentially deadweight. Either commit to migrating the UI to Tailwind, or drop Tailwind. Don't keep both. |

---

## 2. Code-smell scoreboard

These are codebase patterns that compound over time. Numbers are after the SAST P0/P1/P2/P3 work — they're what's **still** there.

| Pattern | Count | Severity | Action |
|---|---|---|---|
| `@Body() body: any` in controllers | **13** | MEDIUM | DTOs already added for the 5 highest-risk (SAST #15). Remaining 13 are auth-gated. Mechanical sweep — one DTO per resource. ~1 day. |
| `as any` casts (any kind) | **78** | LOW-MEDIUM | The 6 high-risk session-lifecycle casts were typed in the SAST follow-up. The rest split roughly: ~20 Prisma input-type patches, ~30 test mocks, ~28 generic typing patches. Add an eslint rule (`@typescript-eslint/no-explicit-any` with selective overrides) before sweeping. |
| `console.log/warn/error` in src | **86** | LOW | Most should migrate to NestJS `Logger` (already used in some services). Inconsistent practice. |
| `style={{...}}` inline JSX | **3,640** in 91 files | DESIGN DECISION | Either keep the inline-styles convention (and drop Tailwind) or migrate to Tailwind classes (and consolidate the `web-*` custom classes). Mixed today. |
| Empty-deps `useEffect(() => {…}, [])` | 8 files | LOW | Some genuinely want mount-only; some are stale-closure bugs in waiting. Each needs a manual read. |
| `await` inside `for` loops | 41 sites | MEDIUM | Sequential awaits are sometimes intentional (rate-limiting an external API) but often accidental. Each is a latency cliff for batch operations. Worth a focused review. |
| TODO / FIXME / HACK / XXX | 1 backend, 0 frontend | LOW | Just one TODO in `auto-capture.service.ts:420` (move captures to dedicated table). Tracked. |

---

## 3. Dead dependencies

These are in `package.json` but **never imported**. Each one:
- Adds install time + bundle weight (frontend) / Docker layer size (backend).
- Counts as supply-chain attack surface — if any gets compromised, we ship a compromised app despite never using the package.
- Inflates `npm audit` output making it harder to spot real issues.

### Backend (`backend/package.json`)

| Package | Why it was probably installed | Safe to remove? |
|---|---|---|
| `aws-sdk` (v2) | S3 upload that never landed | YES — zero source imports |
| `otplib` | Considered for MFA before `speakeasy` was chosen | YES — only `speakeasy` is imported |
| `bull` | Considered for background jobs | YES if no queue work planned soon; else replace with `bullmq` |
| `@nestjs/bull` | Same as above | YES, same gating |
| `cron` | NestJS schedule already handles cron | LIKELY (verify no `import.*cron` outside `@nestjs/schedule`) |

### Frontend (`frontend/portal/package.json`)

| Package | Why probably installed | Safe to remove? |
|---|---|---|
| `zod` | Considered for form validation | YES — zero `from 'zod'` imports |
| `react-hook-form` | Same | YES — zero `from 'react-hook-form'` imports |
| `@hookform/resolvers` | Companion to react-hook-form | YES |
| `tailwindcss` + `@tailwindcss/postcss` | UI plan that didn't land | **DECIDE FIRST** — only 9 Tailwind utility-class usages vs 3,640 inline-style usages. The 9 are in marketing pages and can be migrated to inline styles in minutes. |

**Action:** Removing dead deps is a 1-hour task with high signal. Run `npm uninstall <list>` per package; `tsc --noEmit` + tests confirm nothing breaks.

---

## 4. Backend services — refactor candidates

Largest services by LOC. Largest doesn't always mean broken, but it's where complexity concentrates.

| Service | LOC | Issue | Severity |
|---|---|---|---|
| `quiz/quiz.service.ts` | 775 | Mixes OTP, email confirm, grading, PDF generation, report listing. Could split: `quiz-otp.service`, `quiz-delivery.service`, `quiz-report.service`. Tests pass against the monolith but new features keep growing this file. | MEDIUM |
| `sessions/sessions.service.ts` | 708 | Session lifecycle is a state machine (8+ statuses) implemented as ad-hoc `update` calls scattered across methods. Candidate for a typed state-machine helper that gates transitions. | MEDIUM |
| `mediapipe/auto-capture.service.ts` | 582 | The one TODO in the codebase lives here — "create dedicated Capture table". Currently captures land on `ProctorEvent` rows, which mixes integrity flags with raw frame metadata. Schema refactor worth doing. | LOW |
| `scheduling/scheduling.service.ts` | 550 | Slot-grouping + invitation send + reschedule + reminders all in one. Already has the heaviest comment density — keep but consider extracting `slot-grouping.helper.ts`. | LOW |
| `practical-sets/practical-sets.service.ts` | 543 | Library upload + paper-set CRUD + auto-assignment. Auto-assignment was fixed to CSPRNG in SAST. Otherwise clean — leave alone. | LOW |
| `reports/reports.service.ts` | 509 | Report generation + AI evaluation glue + publish lifecycle. The AI eval glue (OpenAI / Gemini calls) might fit better in a separate `ai-evaluation.service`. | LOW |
| `auth/auth.service.ts` | 400 | Login, refresh, MFA verify (now rate-limited), OTP send/verify, password reset. Each path is small but the file is broad. Splitting `auth-mfa.service` + `auth-otp.service` would help. | LOW |

---

## 5. Frontend — refactor candidates

| File | LOC | Issue | Severity |
|---|---|---|---|
| `app/exam/page.tsx` | **1,447** | The candidate exam page. State machine for the entire proctored flow (waiting room → ID verify → MCQ → practical → submit) plus camera, audio, MediaPipe, ChecklistPanel coordination. Earlier SAST work added `phaseRef` to fix stale-closure bugs. This file is the single biggest source of regressions in past sessions. Strong candidate for splitting into a state machine + per-phase view components. | HIGH |
| `components/proctor/ChecklistPanel.tsx` | 988 | Coupled to the exam page state. Has its own internal hooks for checklist progression. Either keep coupled (then merge with the parent) or properly decouple via a typed prop contract. | MEDIUM |
| `lib/useJitsi.ts` | 873 | WebRTC peer connection management. SAST added warn-logs on the critical catches. Could benefit from a state-machine pattern; right now connection lifecycle is implicit in event handlers. | MEDIUM |
| `app/(portal)/hr/candidates/page.tsx` | 836 | HR candidate management — list + add/edit modal + import wizard + schedule modal. The schedule modal alone is ~200 LOC inside this file. Worth splitting modals into separate components. | LOW |
| `app/(portal)/proctor/reports/[sessionId]/page.tsx` | 656 | Report viewer + AI eval + edit/publish UX. Could split the AI eval section. | LOW |

---

## 6. Auth + session storage — the one big architectural debt

This is **SAST P3 #17** carried forward. Worth its own callout.

- **Current state:** `localStorage` stores the access token AND refresh token. Frontend `lib/api.ts` reads both for every request. Mitigated by no XSS surface today (DOMPurify on all user-rendered strings + `safeHref` allowlist), but `localStorage` is the wrong default for auth tokens.
- **Target state:** Both tokens in `httpOnly` `SameSite=Strict` cookies, with a CSRF token in a non-httpOnly cookie that the frontend echoes in a header. Server validates the CSRF echo on every state-changing request.
- **Surface area of the change:**
  - `frontend/portal/lib/api.ts` — axios interceptor stops reading `localStorage`; relies on cookie. The 401-refresh path needs to call a cookie-friendly refresh endpoint.
  - `backend/src/modules/auth/auth.controller.ts` — `login` and `refresh` set cookies instead of (or in addition to) returning tokens in the body.
  - `backend/src/main.ts` — cookie parser middleware + CSRF middleware (already partially present via `cookie-parser` in deps).
  - JWT strategy — read from cookie OR Authorization header for the candidate magic-link flow (which can't use cookies cross-origin without further work).
  - Every integration test that asserts `accessToken` in the response body.
- **Estimated effort:** 2-3 days of focused work plus a 1-week feature-flag rollout window. Sized as a dedicated sprint.
- **Recommendation:** Schedule. Do not bundle with anything else.

---

## 7. Patterns to introduce (currently absent, would pay off long term)

| Pattern | Where it'd help | Effort | Severity |
|---|---|---|---|
| **eslint rule: `no-explicit-any`** with selective overrides | Backend services, prevent the `as any` count from creeping back up | 1 hour | MEDIUM |
| **Typed Prisma enum imports** | Replace the 78 `as any` casts with `SessionStatus.X` — companion to eslint rule | 1 day mechanical | MEDIUM |
| **Domain DTOs in `dto/` per module** | Sweep the remaining 13 `@Body() body: any`. Pattern is established (SAST #15 work). | 1 day mechanical | MEDIUM |
| **State machines** for session + exam lifecycle | `sessions.service`, `app/exam/page.tsx` — replace scattered `update({ status })` with a transition function that rejects invalid moves | 2-3 days | MEDIUM (longer term) |
| **`pino` structured logging** in Nest | Replace the 86 `console.log` calls with structured fields. Better grep-ability in pm2 logs, JSON ingestible by Loki/Datadog. | 1 day | LOW |
| **OpenAPI generation from controllers → typed frontend client** | `@nestjs/swagger` already emits the spec. A `openapi-typescript-fetch` codegen step gives the frontend a typed API client and replaces hand-maintained `api.ts` types. | 1-2 days | MEDIUM |

---

## 8. Database — Prisma schema observations

29 models, 26 enums, 17 migrations.

- **No obvious denormalisation issues** — relations look healthy from the schema. `_count` selects added in earlier sessions for the activate-readiness gate prevent the obvious N+1.
- **One TODO** for a dedicated `Capture` table (currently overloaded onto `ProctorEvent`). Should land before capture volume becomes a query-plan problem.
- **`Json` field usage** is heavy (CmsPage.content, ExamAnswer.responseData, etc.). Fine for now; if you bump to Prisma 6 you get typed JSON via TypedSQL.
- **Migration count: 17 + one consolidated SQL.** Healthy. The consolidated migration suggests an earlier squash — keep the pattern when migrations cross ~30.

---

## 9. Test coverage

| Layer | What exists | Gap |
|---|---|---|
| Backend unit tests | 28 tests across 3 suites (quiz grading, audit interceptor, notifications htmlToPlainText) | Most services have zero unit tests. The 3 covered are the ones that historically broke. |
| Backend integration tests | 11 tests (quiz flow, branding, atomic OTP race) | Most multi-tenant boundaries are untested. SAST #2 mass-assignment would still slip through the test suite. |
| Frontend tests | Playwright scaffold exists in `/e2e` | Almost no real test runs. The scaffold has 1-2 smoke tests. |
| End-to-end candidate flow | Manual today | The exam page is the most regression-prone surface and has no automated coverage. Worth Playwright tests for the quiz + proctored happy paths at minimum. |

---

## 10. Operations — quick wins

| Item | What | Effort | Severity |
|---|---|---|---|
| **pm2 update** | Running daemon is 6.0.14, installed is 7.0.1. Restart cycles work but the daemon is out of date. `pm2 update` reloads everything once. | 5 minutes (maintenance window) | LOW |
| **Stray root `package-lock.json`** | `/var/www/html/assessexpert/package-lock.json` exists at the repo root and confuses Next.js Turbopack (warning every build). Delete it. | 2 minutes | LOW |
| **Backend `.env` lockfile fix** | `npm ci` keeps failing on the VPS because `package-lock.json` is out of sync with `package.json` (transitive deps for native bindings). Regenerate on a Linux box and commit. | 30 minutes | LOW |
| **CSP enforcement flip** | `CSP_REPORT_ONLY=false` once 2 weeks of report-only traffic is clean. | 5 minutes | MEDIUM (deadline-driven by SAST followups) |
| **Dependabot / Renovate** | Automatic PRs for dep updates with grouping (e.g. all `@nestjs/*` together). Set up once, then dependency drift becomes a 5-min weekly review. | 1 hour | MEDIUM |

---

## 11. Recommended rollout order

If we tackle this list, the order that maximises return / minimises risk:

### Sprint 1 — Hygiene + low-risk modernisation (1 day total)
1. Remove dead deps (§3) — `npm uninstall` cycle, verify build + tests
2. Decide on Tailwind (§3 + §1.2): keep + adopt, or remove + migrate the 9 utility-class usages to inline
3. Bump patch versions across both apps (Next 16.2.x latest, Prisma 5.22 explicit pin, `@nestjs/*` patch line)
4. Delete stray root `package-lock.json`
5. Regenerate `backend/package-lock.json` on Linux + commit

### Sprint 2 — Single high-value major (~2-3 days)
- **`multer` 1.x → 2.x** — single highest-leverage bump. Closes the bulk of the npm-audit noise. Read the migration guide, run the file upload paths in dev, regression-test practical submission + question import.

### Sprint 3 — NestJS 10 → 11 (~2 days)
- Coordinated bump across all `@nestjs/*` packages. Small Reflector + Logger touch-ups. Tests should catch any breakage.

### Sprint 4 — Cookie auth migration (~3 days)
- §6 — the JWT-in-localStorage replacement. Dedicated sprint with feature flag + rollback.

### Sprint 5 — Code quality sweep (~3 days)
- Eslint `no-explicit-any` + typed Prisma enums sweep
- Remaining 13 `@Body() body: any` → DTOs
- `console.log` → Logger
- The 41 `await`-in-`for-loop` sites: audit each

### Sprint 6 — Test coverage push (~5 days)
- Playwright happy-path tests for quiz + proctored exam
- Unit tests for the 8 largest backend services
- Integration tests for tenant isolation (proves §SAST findings stay fixed)

---

## 12. What this analysis does NOT do

- **No code changes.** This is the catalogue. Approve any subset and I'll execute.
- **No commitment to a specific upgrade path.** NestJS 10 → 11 → 12 is a choice; the analysis lays out what's involved, not which to pick.
- **No exhaustive line-by-line review.** Patterns and scoreboards above are sampled — a full line review of a 36k-LOC codebase is a multi-week piece in itself.
- **No performance profiling.** That's a separate task — runtime + DB query traces from a real production workload.
- **No security implications beyond SAST.** SAST_REPORT.md is the current security catalogue; this file is the *engineering health* catalogue.

---

## Summary — quick numbers

| Metric | Value |
|---|---|
| Backend LOC | 14,728 |
| Frontend LOC | 21,479 |
| Backend modules | 31 |
| Prisma models | 29 |
| Prisma enums | 26 |
| Migrations | 17 |
| Backend deps (prod) | ~47 |
| Frontend deps (prod) | ~19 |
| Backend dev deps | ~10 |
| Test count | 28 unit + 11 integration |
| Critical SAST items still open | 0 (all P0/P1/P2 closed; P3 #17 deferred with rationale) |
| Major framework bumps available | NestJS 10→11, Multer 1→2, Prisma 5→6, Helmet 7→8, Puppeteer 22→24, framer-motion 12→13 |
| Dead deps removable today | ~9 packages |
