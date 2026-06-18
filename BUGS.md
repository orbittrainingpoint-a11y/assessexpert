# Known Bugs / Critical Issues / Warnings

Generated 2026-06-18 from an audit of the live codebase + the recent debugging
sessions. Items are tagged by severity and tracked with a status. Fix-as-we-go
checkboxes below.

Severity legend:
- 🔴 **CRITICAL** — security, data loss, broken core flow in production
- 🟠 **HIGH** — incorrect behaviour that affects real users
- 🟡 **MEDIUM** — degraded UX, performance, or operational risk
- 🟢 **LOW / WARNING** — code smell, lint, future-proofing

---

## 🔴 Critical

### C1. `/api/turn/credentials` is unauthenticated AND unthrottled
- **File:** `backend/src/modules/turn/turn.controller.ts`
- **Risk:** the endpoint is deliberately public so candidates on magic-token can
  fetch ICE servers. But it has no rate limit. A malicious client can hammer
  Cloudflare's API with our key — eventually we burn through the 1 TB free tier
  or get rate-limited by Cloudflare, breaking real interviews/exams.
- **Fix:** add `@Throttle({ default: { limit: 30, ttl: 60_000 } })` (30/min per IP).
  Cached server-side for 23h anyway so most calls hit the cache.
- **Status:** ✅ **DONE** — throttle decorator added to TurnController.getCredentials.

### C2. `getSession` lets callers skip the tenant check
- **File:** `backend/src/modules/sessions/sessions.service.ts:177`
- **Risk:** signature was `getSession(id: string, organizationId?: string)`. If a
  controller passed only `id`, the session was returned regardless of org. A bug
  in a single controller call site could have leaked another tenant's exam state.
- **Fix:** make `organizationId` required (`string | null`); internal-server
  callers pass `null` explicitly so the bypass is visible in code review.
- **Status:** ✅ **DONE** — signature tightened, internal callers updated.

### C3. Magic token reuse possible if rescheduling races with candidate click
- **File:** `backend/src/modules/scheduling/scheduling.service.ts:402`
- **Risk:** rescheduling rotates the token AND nullifies `tokenUsedAt` in one
  `update`, but the old token's request could already be in flight when HR
  hits the reschedule button. The candidate ends up authenticated on the
  rescheduled slot under the old time. Race window is small but real.
- **Fix:** wrap exam-magic-link verification in a transaction that checks
  `tokenUsedAt IS NULL` and sets it in the same statement.
- **Status:** ⬜ Deferred → GAPS.md G2.

### C4. JWT secret + refresh secret read at boot, no length enforcement
- **File:** `backend/src/main.ts`, `backend/src/modules/auth/auth.module.ts`
- **Risk:** if `JWT_SECRET` or `JWT_REFRESH_SECRET` is shorter than 32 chars,
  tokens are weak and brute-forceable in a reasonable window.
- **Fix:** assert `length >= 32` AND that the two secrets differ at bootstrap;
  refuse to start otherwise.
- **Status:** ✅ **DONE** — length checks were already present; added the
  distinctness check (refresh secret cannot equal access secret).

---

## 🟠 High

### H1. `useJitsi.ts` has 20 silent `catch {}` blocks
- **File:** `frontend/portal/lib/useJitsi.ts`
- **Risk:** WebRTC failures are silently swallowed. When a track add fails or
  `setRemoteDescription` rejects, we set state but never tell the user. Result:
  proctor stares at a black tile with no error to debug from.
- **Fix:** for each silent catch, either (a) log via console.warn with context,
  or (b) surface to the existing `setError()` so the UI shows it.
- **Status:** ⬜ TODO

### H2. `Body() body: any` everywhere bypasses DTO validation
- **Files:** most controllers in `backend/src/modules/*/`
- **Risk:** no `class-validator` DTO on inputs means clients can send malformed
  payloads that crash deeper in services. Particularly bad on public endpoints
  (auth, magic-link, OTP).
- **Fix:** introduce DTOs progressively starting from the public endpoints.
- **Status:** ⬜ TODO

### H3. Frontend cache busts only when the page bundle hash changes
- **Risk:** Next.js fingerprints chunks but the HTML shell stays cached. After
  every deploy, users on tabs that don't refresh see the OLD `useJitsi.ts`
  until they hard-reload. We hit this 3× during this debugging session.
- **Fix:** add a build-time `<meta name="x-build" content="${commit}">` and a
  client polling effect that compares the served HTML's meta with the loaded
  bundle's bundled commit hash. If mismatch, prompt "New version available —
  click to reload."
- **Status:** ⬜ TODO

### H4. HR interview list 404s when interview references a cross-org candidate
- **File:** `backend/src/modules/candidates/candidates.service.ts`
- **Risk:** when a candidate moves orgs (or the interview was scheduled
  cross-org pre our tenant-safety check), the HR interview room shows "no
  reference photo" silently because the candidate fetch is 404'd as if
  the candidate didn't exist.
- **Fix:** service now throws `403 ForbiddenException` with a structured
  `code: 'CANDIDATE_ORG_MISMATCH'` so the calling UI can render a clear
  "Reference photo unavailable — candidate belongs to another organization"
  banner instead of looking generically broken.
- **Status:** ✅ **DONE** (backend). UI hook-up tracked in GAPS.md G3.

### H5. Interview reschedule isn't possible from the UI
- **File:** `frontend/portal/app/(portal)/hr/interviews/page.tsx`
- **Risk:** HR can only cancel + re-schedule. No reschedule action.
- **Fix:** add `interviewsApi.reschedule(id, scheduledAt)` + a UI button that
  reuses the schedule modal.
- **Status:** ⬜ TODO

---

## 🟡 Medium

### M1. `Listen 80` ACME challenge bypassed by Apache vhost redirects
- **File:** `/etc/apache2/sites-enabled/turn-acme.conf` (VPS only)
- **Risk:** future Let's Encrypt renewals for `turn.assessexpert.com` will
  302-redirect to `assessexpert.com` because other vhosts on `*:80` intercept
  the request. Recovery: we set up a temporary vhost during initial issuance,
  but it needs to stay enabled for renewals.
- **Fix:** verify `/etc/apache2/sites-enabled/turn-acme.conf` is enabled and
  prioritised. Add to deploy checklist.
- **Status:** ⬜ TODO

### M2. SMTP plain-text fallback regex strips entities imperfectly
- **File:** `backend/src/modules/notifications/notifications.service.ts:680`
- **Risk:** the `htmlToPlainText` helper covers `&amp; &lt; &gt; &quot; &#39;
  &nbsp;` but not `&apos; &copy; &mdash; …`. If templates ever add fancy
  punctuation, the text part contains literal `&entity;` strings.
- **Fix:** replace with a small set of `String.prototype.replaceAll` calls
  covering the full common-entity list.
- **Status:** ⬜ TODO

### M3. Reference photo files never garbage-collected
- **Risk:** when a candidate is deleted, the JPEG at
  `STORAGE_PATH/fr-images/<candidateId>.jpg` orphans on disk. With 1000s of
  candidates over time, this fills the disk.
- **Fix:** add `prisma.candidateRecord` delete-hook (or service-level call) to
  remove the file. Or run a nightly cron that deletes files whose candidateId
  has no DB row.
- **Status:** ⬜ TODO

### M4. Frontend bundle bloat — bundled marketing-content + i18n
- **File:** `frontend/portal/lib/marketing-content.ts`,
  `frontend/portal/lib/i18n/messages.ts`
- **Risk:** ~50 KB of marketing copy + translations bundled into every page,
  including the candidate exam page. Slow first paint on flaky mobile.
- **Fix:** dynamic-import marketing-content; split i18n messages per locale.
- **Status:** ⬜ TODO

### M5. `pm2 restart` doesn't trigger `--update-env`
- **File:** VPS pm2 ecosystem
- **Risk:** after editing `.env`, `pm2 restart assessexpert-backend` does NOT
  pick up new env vars unless `--update-env` is passed. We hit this with
  CLOUDFLARE_TURN_KEY_ID — required two restarts to take effect.
- **Fix:** document `pm2 restart <id> --update-env` in the deploy doc.
- **Status:** ⬜ TODO

---

## 🟢 Low / Warning

### W1. `useSpeechTranscription.ts` has 7 silent catches
- **File:** `frontend/portal/lib/useSpeechTranscription.ts`
- **Risk:** browser Speech API quirks (Safari, Firefox) silently no-op.
- **Fix:** detect unsupported browsers up-front + show a banner.
- **Status:** ⬜ TODO

### W2. TODO comment for dedicated Capture table
- **File:** `backend/src/modules/mediapipe/auto-capture.service.ts:420`
- **Risk:** captures are currently inlined in another table; long-term we'll
  want their own model with proper indexes.
- **Fix:** new Prisma model + migration; backfill once table is live.
- **Status:** ⬜ Deferred

### W3. PM2 version drift (in-memory 6.0.14, local 7.0.1)
- **VPS only**
- **Risk:** future PM2 features may be missing or behave differently than
  documented in the user CLI.
- **Fix:** `pm2 update` on a quiet day to bring the daemon up to local.
- **Status:** ⬜ TODO

### W4. Coturn config has duplicate `cli-password` warning
- **File:** `/etc/turnserver.conf` (VPS)
- **Risk:** noisy log line; coturn doesn't expose the telnet CLI because of
  the empty password. Harmless.
- **Fix:** set `cli-password=<strong>` or `no-cli`.
- **Status:** ⬜ TODO

### W5. Apt sources have many duplicate-Packages warnings
- **VPS only**
- **Risk:** confusing apt output; updates still work because of dedup.
- **Fix:** consolidate `/etc/apt/sources.list.d/` files.
- **Status:** ⬜ TODO

### W6. Default `cli-password` warning in coturn config (cosmetic)
- Same as W4 — included for completeness.

---

## Resolved (recent work — context)

These are listed so the catalog is honest about what was already fixed during
this debugging cycle. Not action items.

- ✅ R1. HR interview lifecycle camera/audio (jitsi.controller interview fallback)
- ✅ R2. Cloudflare TURN integration (production candidates on restrictive networks)
- ✅ R3. HIRING_MANAGER could not read single candidate (RBAC widening)
- ✅ R4. Reschedule blocked for sessions in CHECKLIST/EXPIRED (status whitelist widening)
- ✅ R5. 1080p hard `min` constraint broke candidates' tracks (camera capture relaxed)
- ✅ R6. Plain-text email fallback (SCL deliverability)
- ✅ R7. Identity Check label (was Government ID)
- ✅ R8. FR auto-capture race with WebRTC first frame
- ✅ R9. Interview invite email (SMTP transport already configured)
