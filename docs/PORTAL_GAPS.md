# Portal Gaps & Critical Issues — Execution Backlog

Audit of the Next.js portal at `frontend/portal/` for gaps, bugs,
security weaknesses, and polish items. Grouped by severity — work
top-down. Each item includes the file(s), the fix, and rough effort.

Legend:
- 🔴 **CRITICAL** — security or data-integrity risk, or a broken production flow
- 🟠 **HIGH**   — user-visible bug, blocks a supported use case, or a real security gap
- 🟡 **MEDIUM** — polish / UX / hygiene that a serious platform should not ship without
- 🔵 **LOW**    — nice-to-have

---

## 🔴 CRITICAL — Security & Auth

### C1. JWT + refresh token stored in `localStorage`
- **Files:** `store/auth.store.ts:32-33`, `lib/api.ts:13,37`
- **Why it matters:** Any XSS anywhere in the app leaks BOTH tokens.
  Industry standard is `httpOnly; Secure; SameSite=Strict` cookies so
  JS can never read them. Our CSP is still REPORT-ONLY so it does not
  actually block script injection today.
- **Fix:** Move access + refresh tokens to httpOnly cookies set by
  backend on login. Frontend keeps only non-sensitive user profile in
  Zustand. `withCredentials: true` is already on the axios client, so
  cookies will ride along automatically.
- **Effort:** M — backend `/auth/login` needs to set cookies; frontend
  drops the localStorage writes and Bearer header; SSR routes that
  need auth switch to reading from the cookie.

### C2. CSP is still REPORT-ONLY
- **File:** `proxy.ts:24` (`REPORT_ONLY = process.env.CSP_REPORT_ONLY !== 'false'`)
- **Why it matters:** The header ships, browsers report violations, but
  nothing actually blocks. XSS injection would execute.
- **Fix:** After a week of production traffic with zero legitimate
  violations reported, set `CSP_REPORT_ONLY=false` in
  `.env.production` and redeploy. Wire a report-uri endpoint first so
  we catch real violations before flipping.
- **Effort:** S once we have violation telemetry.

### C3. Debug docs shipped in the repo
- **Files:** `frontend/portal/LIVE_SERVER_DEBUG.md`,
  `frontend/portal/403_FORBIDDEN_EXPLAINED.md`
- **Why it matters:** These sit at the frontend root and get bundled
  into the deploy. They contain internal debug commands, JWT dump
  snippets, and internal API shape hints. Not catastrophic, but they
  don't belong on the production server.
- **Fix:** Move under `docs/` at repo root, or delete. Add a
  `.dockerignore` / `.nextignore` rule to keep future stray docs out
  of the deploy.
- **Effort:** XS.

### C4. `.env.production` and `.env.local` in the working directory
- **Files:** `frontend/portal/.env.production`, `.env.local`
- **Why it matters:** They should NEVER be committed. Verify
  `.gitignore` blocks them and rotate any secrets they contain if
  they were ever pushed.
- **Fix:** `git log --all -- frontend/portal/.env.production` — if any
  history exists, treat every secret in those files as leaked and
  rotate. Then confirm they are in `.gitignore` at both repo levels
  (superrepo and submodule).
- **Effort:** XS to check; M if rotation is needed.

### C5. 48 `console.log/warn/error` calls remain in production build
- **Scope:** 12 files, per earlier count (`hooks`, `lib`, admin pages)
- **Why it matters:** Some log objects that may contain tokens,
  candidate PII, or session ids. Any user can open DevTools and see
  them. Also leaks internal call flow to competitors.
- **Fix:** Add `compiler.removeConsole: { exclude: ['error', 'warn'] }`
  to `next.config` for production. Keep `console.error` for genuine
  errors that should reach Sentry. Then audit remaining `console.warn`
  for PII.
- **Effort:** S (config + one grep pass).

### C6. `dangerouslySetInnerHTML` — audited
- **Files:** `app/exam/page.tsx:1139` (DOMPurified ✅),
  `app/blog/[slug]/page.tsx:117` (DOMPurified ✅),
  `app/services/[slug]/page.tsx:132` + `app/manpower/[role]/page.tsx:127` (DOMPurified ✅),
  `lib/seo-schema.ts:165` + JSON-LD blocks (JSON.stringify ✅),
  `app/layout.tsx:84` (inline chunk-reload guard, no user input ✅)
- **Status:** All safe today. Add a lint rule to prevent future
  unsanitised additions: eslint-plugin-react `no-danger` + a project
  override that allows the sanitised call sites.
- **Effort:** S.

---

## 🟠 HIGH — Bugs & Broken UX

### H1. Mojibake arrows on primary buttons
- **Files:** `app/exam/page.tsx:1092` (`Verify & Continue â†→`), `app/exam/page.tsx:1235` (`Enter Waiting Room â†→`), plus every `Icon name="…"` usage that uses `\u{1F4CB}`-style escapes in the WORKFLOW_STEPS array
- **Why it matters:** The literal bytes `â†→` show as garbage on modern
  browsers instead of `→`. Same file has other Unicode escapes done
  with `\u{...}` sequences which DO render correctly — so the fix is
  consistent syntax.
- **Fix:** Replace every `â†→` / mojibake sequence with either:
  1. Real `<ArrowRight size={14} />` from `lucide-react` inside a flex
     button (matches the design language used everywhere else), or
  2. A proper Unicode escape `→` in the string
- **Effort:** S — one Python script to sweep the exam page,
  15 mins to review + commit.

### H2. Camera pre-check UI was lying (fixed 2026-07-30 but verify)
- **File:** `app/exam/page.tsx` phase='camera' block (~1172-1240)
- **Status:** already patched to reflect real device state, but
  re-verify on deploy — mojibake chars in the label strings made the
  original edit fragile.
- **Action:** Take a screenshot on the live site with `phase=camera`
  and confirm all four rows show real state, no green ticks for
  broken devices.

### H3. `useSessionRecorder` finalize race (fixed 2026-07-30)
- **File:** `lib/useSessionRecorder.ts`
- **Status:** patched to wait for in-flight uploads before finalize.
  Verify in a real session by inspecting the network tab: `finalize`
  POST should fire AFTER the last `chunk` POST returns.

### H4. Face similarity comparison never worked automatically
- **File:** `backend/src/modules/mediapipe/mediapipe.service.ts:263-281`
- **Why it matters:** The "embedding" was a fake computed from landmark
  positions — not a real face-recognition model. Even if the backend
  MediaPipe loaded, similarity scores were meaningless. Post 2026-07
  patch we mark such comparisons `PENDING_REVIEW` so the proctor
  manually confirms.
- **Fix (long-term):** Switch to a real face-recognition library —
  `@vladmandic/face-api` runs on Node with `@tensorflow/tfjs-node`.
  Regenerate every candidate's reference embedding with the new model.
- **Effort:** L — new dep, new model files, migration for existing
  embeddings.

### H5. Empty `.catch(() => {})` blocks silently swallow errors
- **Scope:** Found in many hooks (`useSpeechTranscription`,
  `useSessionRecorder`, etc.) and page effects.
- **Why it matters:** A real API failure looks like nothing happening.
  Users blame their internet, we blame the user, no one gets a fix.
- **Fix:** Every `.catch(() => {})` becomes
  `.catch(e => Sentry.captureException(e))` (Sentry is already wired
  in `providers.tsx`). Optionally also `console.warn` in dev.
- **Effort:** M — grep and patch systematically.

### H6. 401 redirect strategy loses in-progress work
- **File:** `lib/api.ts:42-47`
- **Behavior:** On refresh failure, hard-redirects to `/login`. Any
  form the user was filling out is gone.
- **Fix:** Before redirecting, `sessionStorage.setItem('returnTo', location.pathname + location.search)`
  and consume that on successful login. Also show a toast BEFORE
  redirect so the user knows why the page vanished.
- **Effort:** S.

### H7. Manpower page not in CMS
- **File:** `backend/prisma/seed-cms.ts` (missing `manpower` entry)
- **Why it matters:** `/manpower` renders from bundled `PAGE_CONTENT.manpower`
  fallback. CMS admin at `/cms/pages` has no row to edit hero copy.
- **Fix:** Add `manpower` to the `PAGE_SLUGS` in `seed-cms.ts` +
  populate a default content JSON, then re-run seed on the VPS.
- **Effort:** XS.

### H8. No session-timeout warning before token expiry
- **Why it matters:** Access tokens expire (typically 15 min). Users
  get silently kicked to `/login` mid-work with no warning.
- **Fix:** Decode the JWT `exp` client-side, show a toast at
  `exp - 2min` saying "Session about to expire — click to extend",
  which triggers a `/auth/refresh` call.
- **Effort:** M.

---

## 🟡 MEDIUM — Polish & Hygiene

### M1. No loading skeletons — everything shows "Loading..."
- **Scope:** Admin tables, HR candidate list, CMS pages listing.
- **Fix:** Reusable `<Skeleton>` component sized to the row height,
  render N of them while the query is pending.
- **Effort:** M.

### M2. Empty states are generic text, not designed
- **Scope:** Same pages as M1.
- **Fix:** Empty state component with an illustration/icon, one-line
  explanation, and a CTA ("Add first candidate", "Create first
  assessment").
- **Effort:** M.

### M3. Accessibility gaps
- **Symptoms:**
  - Missing `aria-label` on icon-only buttons (proctor page has many)
  - No `aria-live="polite"` on the checklist status changes
  - Focus outline styles removed globally on some buttons — keyboard
    users can't tell what's focused
- **Fix:** axe-devtools sweep. Add landmark roles to nav, main, and
  the proctor grid. Restore `:focus-visible` outlines on the button
  primitives.
- **Effort:** M.

### M4. Toast styling inconsistent
- **File:** `app/providers.tsx:63-72`
- **Issue:** Success toasts are green, errors are rose, but info /
  warning toasts fall back to the default which looks off-brand.
- **Fix:** Add `warning` and `info` variants to the react-hot-toast
  config with the same visual language as success/error.
- **Effort:** XS.

### M5. Sitemap does not include auth-required routes properly gated
- **File:** `app/sitemap.ts`
- **Status:** Currently emits only public routes (correct). Just
  document this so no one adds an admin route to it by mistake.
- **Effort:** XS.

### M6. `next/image` not used for marketing hero images
- **Scope:** `app/page.tsx`, `app/services/[slug]/page.tsx`,
  `app/manpower/[role]/page.tsx` — hero doesn't ship images yet, but
  when it does, use `next/image` for automatic optimization.
- **Effort:** N/A until images are added.

### M7. i18n coverage is thin
- **File:** `lib/i18n/LocaleProvider.tsx` + tech-check page
- **Status:** Only `tech_check.*` strings are wired to `useTranslation`.
  Everything else is hardcoded English.
- **Fix:** Extract strings from the candidate exam flow first (highest
  business value — bilingual delivery is a headline claim). Then
  proctor UI. Marketing pages are lower priority.
- **Effort:** L.

### M8. Password strength meter missing
- **File:** `app/reset-password/[token]/page.tsx`
- **Fix:** Add a zxcvbn-style meter with 4 bars, so users know if their
  new password is trivially breakable before they submit.
- **Effort:** S.

---

## 🔵 LOW — Nice-to-have

### L1. PWA / offline shell
- Service worker for the candidate exam page so a transient network
  blip doesn't kill their attempt. High technical complexity, high
  test burden. Not immediate.

### L2. Dark/light theme toggle
- The app currently ships one dark theme. A `prefers-color-scheme`
  respecting light theme is a modest client value.

### L3. Profile management for regular users
- `/me/privacy` exists (GDPR self-service). No `/me` page for
  changing name, avatar, notification prefs. Add if we get support
  tickets asking for it.

### L4. Bulk operations in admin tables
- Multi-select + bulk actions (delete, deactivate, reassign) in HR
  candidates, Admin users, CMS posts.

---

## Execution Plan (Suggested Order)

Sprint 1 — one week, security-first:
- **C1** httpOnly cookies for tokens
- **C3** move debug docs
- **C4** verify .env not committed + rotate if leaked
- **C5** strip console.log in production build
- **H1** mojibake arrows sweep
- **H7** seed manpower CMS row

Sprint 2 — bug hunt:
- **H5** replace silent catches with Sentry capture
- **H6** returnTo on 401 redirect
- **H8** session-timeout warning
- **C2** flip CSP to enforce (after a week of report-only telemetry)

Sprint 3 — polish + gaps:
- **M1 / M2** loading skeletons + empty states
- **M3** accessibility sweep
- **M8** password strength meter
- **H4** real face-recognition library (biggest lift, do last)

Anything in 🔵 LOW is opportunistic — pick up when a real user asks
or when a related area is being touched anyway.
