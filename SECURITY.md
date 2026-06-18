# Security Findings & Posture

Generated 2026-06-18 from a focused review of the live codebase. Tracks
issues that affect confidentiality, integrity, or availability — separate
from BUGS.md (correctness) and GAPS.md (missing features).

Severity legend:
- 🔴 **CRITICAL** — exploitable in production, immediate ship
- 🟠 **HIGH** — exploitable under realistic conditions
- 🟡 **MEDIUM** — defence-in-depth gap, secondary control
- 🟢 **LOW** — best-practice hardening

---

## 🔴 Critical

### S1. JWT_SECRET vs JWT_REFRESH_SECRET equality not enforced (HISTORIC)
- **Risk:** if both env vars were set to the same value, a stolen access
  token could be replayed as a refresh token.
- **Status:** ✅ **FIXED** (BUGS C4) — `main.ts` now refuses to boot if
  the two values are equal AND if either is shorter than 32 chars.
- **Required action:** none. Verify after a deploy that the backend
  came up successfully.

### S2. `getSession` allowed tenant bypass on optional `organizationId` (HISTORIC)
- **Risk:** a controller bug could return another tenant's full exam
  session record.
- **Status:** ✅ **FIXED** (BUGS C2) — signature is now
  `organizationId: string | null`; internal callers pass `null`
  explicitly. The bypass is now visible in code review.

---

## 🟠 High

### S3. `/api/turn/credentials` was unauthenticated AND unthrottled (HISTORIC)
- **Risk:** unbounded API calls against Cloudflare's TURN minting using
  our key. A hostile client could exhaust the 1TB free tier or get our
  key Cloudflare-side rate-limited, breaking real interviews/exams.
- **Status:** ✅ **FIXED** (BUGS C1) — `@Throttle({ default: { limit: 30,
  ttl: 60_000 } })` (30 calls/min/IP). Server-side cache (23h) absorbs
  legitimate use well under the ceiling.

### S4. `@Body() body: any` everywhere skips input validation
- **Files:** most controllers in `backend/src/modules/*/`
- **Risk:** no `class-validator` DTOs on inputs — clients can send
  malformed payloads that crash deeper in services, bypass validation
  expectations, or pass through arbitrary fields to Prisma `update`
  calls (mass assignment).
- **Suggested fix:** introduce DTOs progressively starting from the
  highest-risk public endpoints — login, OTP send/verify, magic-link
  verify, candidate-token, magic-link interview lookup.
- **Severity rationale:** Prisma's typed updates limit blast radius, but
  e.g. `interviews.controller` accepts `body: any` for `end()` and
  forwards unfiltered shape — verdict/recommendation/notes could be
  arbitrary types if a client lies.
- **Status:** ⬜ TODO

### S5. Magic-link verification is non-atomic (race window)
- **File:** `backend/src/modules/exam-delivery/exam-delivery.service.ts`
- **Risk:** two browser tabs can both succeed in verifying the same
  exam magic link if they race. We read `tokenUsedAt IS NULL`, then
  set it — two concurrent reads both see null, both set it, both
  succeed.
- **Suggested fix:** Prisma `updateMany({ where: { magicToken,
  tokenUsedAt: null }, data: { tokenUsedAt: new Date() } })` and check
  `result.count === 1` before proceeding.
- **Severity rationale:** narrow exploit window (~10ms between read
  and write), but the impact is high — both browsers join the same
  session under different proctoring contexts.
- **Status:** ⬜ TODO (tracked in GAPS.md G2 also)

### S6. Inline marketing content rendered with `dangerouslySetInnerHTML`
- **File:** `frontend/portal/app/exam/page.tsx:1088`,
  `frontend/portal/app/blog/[slug]/page.tsx`, etc.
- **Risk:** if a CMS user (CMS_ADMIN role) injects malicious HTML/JS
  into a blog post or legal copy, it executes in the candidate's
  browser during exam.
- **Mitigation in place:** uses `DOMPurify.sanitize(...)` consistently
  in the exam page. **Blog page does NOT sanitize** — verify CMS_ADMIN
  role assignment is trusted before relying on this.
- **Suggested fix:** wrap every `dangerouslySetInnerHTML` site with
  `DOMPurify.sanitize`. Add a lint rule to enforce.
- **Status:** ⬜ TODO

---

## 🟡 Medium

### S7. No CSP on the Next.js portal HTML response
- **Risk:** XSS or rogue third-party script can run unrestricted. A
  user-side breach (browser extension, network MITM on http) has full
  capability.
- **Suggested fix:** add `Content-Security-Policy` via Next.js middleware
  with `default-src 'self'; img-src 'self' data: https:;
  connect-src 'self' https://rtc.live.cloudflare.com
  wss://${WS_URL}; …`.
- **Status:** ⬜ TODO

### S8. File-upload validation surface
- **Files:** reference photo capture, recording chunks,
  `RecordingsController`
- **Risk:** clients can send oversized files, wrong mime types, or
  filenames with directory traversal. Most validation is implicit via
  multer config but worth auditing.
- **Suggested fix:** explicit mime allowlist (`image/jpeg`,
  `image/png`, `video/webm`) and a max-bytes guard per endpoint;
  rename uploaded files to a server-generated UUID instead of trusting
  client name.
- **Status:** ⬜ TODO

### S9. SMTP_PASS stored in plaintext in `.env`
- **File:** `backend/.env`
- **Risk:** anyone with file-system read on the VPS can extract the
  Gmail app password (or whichever SMTP service). Standard for envs
  but worth noting.
- **Mitigation:** rotate to AWS SES / Postmark / Resend API key (still
  in env but scoped per-API-key, easier to revoke than a Gmail app
  password). Or move secrets to a vault (Doppler, Infisical, GCP
  Secret Manager).
- **Status:** ⬜ Defer until production volume warrants

### S10. JWT in `localStorage` (not `httpOnly` cookie)
- **File:** `frontend/portal/lib/api.ts` reads
  `localStorage.getItem('accessToken')`
- **Risk:** XSS exfiltration. With CSP missing (S7) and one
  unsanitized `dangerouslySetInnerHTML` (S6) the attack surface for
  XSS is real. localStorage tokens are stolen by any script that
  runs.
- **Suggested fix:** switch to `httpOnly`, `Secure`, `SameSite=Strict`
  cookies with CSRF protection. Significant change — touches auth
  flow throughout.
- **Status:** ⬜ Deferred — pairs with S5/S7 for a hardening sprint

### S11. No password-strength validation on signup/invite
- **File:** `backend/src/modules/users/users.service.ts`
- **Risk:** weak passwords accepted at user creation. Brute-force
  surface on the login endpoint.
- **Mitigation in place:** OTP is CSPRNG; account-lockout exists on
  failed login attempts (per `auth.service.ts`).
- **Suggested fix:** require min 12 chars, mix of cases, digits, or
  use `zxcvbn` for strength scoring.
- **Status:** ⬜ TODO

### S12. No audit log on sensitive actions
- **What's missing:** who deleted candidate X, who changed which
  user's role, who cancelled which interview.
- **Mitigation in place:** there's an `AuditLog` model in the schema
  but its emit sites are sparse.
- **Suggested fix:** controller decorator or interceptor that auto-
  emits AuditLog rows on every mutation, keyed by user+action+target.
- **Status:** ⬜ TODO

---

## 🟢 Low / hardening

### S13. CORS allows credentials with multiple origins
- Origins from `FRONTEND_URLS` are read and applied — fine, but
  ensure `credentials: true` is paired with exact-origin matching (not
  wildcard).
- **Mitigation in place:** `main.ts` uses an exact-match function for
  `origin`.

### S14. `helmet` defaults applied but CSP is in report-only mode (if any)
- Confirm `helmet({ contentSecurityPolicy: false })` is intentional —
  currently set this way because the API serves JSON + static
  uploads, not HTML. Fine for the API surface; frontend needs its
  own CSP (S7).

### S15. WebRTC turnserver password in NEXT_PUBLIC_TURN_SECRET
- **File:** `frontend/portal/.env.production`
- **Risk:** the secret is baked into the JS bundle (all
  `NEXT_PUBLIC_*` are public). Anyone can read it and use it to relay
  through your coturn at our cost.
- **Mitigation:** coturn is rate-limited per IP at the OS layer; the
  Cloudflare TURN path uses ephemeral creds minted server-side (S3
  fixed).
- **Suggested fix:** move self-hosted coturn to ephemeral-credential
  mode too (REST-based auth), so even the baked-in secret expires.
- **Status:** ⬜ Defer — Cloudflare TURN is the primary path now;
  coturn is a fallback.

### S16. Database connection password in `.env`
- Standard practice. Recommend rotating to IAM-based auth on managed
  Postgres (AWS RDS, Supabase) when migrating.

### S17. No CSRF tokens
- Because tokens are in localStorage (S10), CSRF doesn't apply — but
  if cookie-based auth is adopted (S10 fix), CSRF tokens become
  mandatory.

### S18. Email plain-text fallback regex strips entities imperfectly
- See BUGS M2 — cosmetic, but ensure email templates can't be
  weaponised by injecting unescaped user input.

---

## Compliance / GDPR notes (informational)

- Candidate webcam recordings are stored on disk at `STORAGE_PATH`.
  Retention policy is undefined in code.
- **Suggested:** implement a nightly job that deletes recordings
  older than N days (configurable per org), or move to S3 with a
  lifecycle rule.
- Reference photos persist after candidate deletion (BUGS M3) until
  the GC job ships.
- DMARC was tightened to `p=quarantine` for `elissh.com` per the
  earlier deliverability work — confirm a similar policy is set for
  every domain that sends from this backend.

---

## Top 6 to ship next (priority order)

1. **S6** — sanitize blog `dangerouslySetInnerHTML` (10 min)
2. **S5** — atomic magic-link verification (30 min)
3. **S4** — DTOs on top 5 public endpoints (auth, OTP, magic-link
   verify, candidate-token, interview-public) (3 hours)
4. **S7** — Next.js CSP middleware (1 hour)
5. **S8** — file-upload mime + size guard rails (2 hours)
6. **S12** — audit log interceptor (3 hours)

Items S10 / S11 / S15 are bigger changes — bundle into a "hardening
sprint" rather than ship piecemeal.
