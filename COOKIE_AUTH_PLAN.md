# Sprint 4 — Portal Cookie Auth Migration Plan

**Status:** Planning. No code changes yet.
**Drafted:** 2026-06-23
**Scope reduction note (important):** This plan explicitly excludes the **candidate magic-link flow** (`/exam`, `/quiz`, `/interview` routes). Candidates open exams from a third-party email link, which is a cross-origin context where cookies are fragile and where the trust model is the magic-link token itself, not a user session. Scoping to **portal users only** (HR, proctor, admin, master proctor, exam-setup, sales, CMS editor) cuts the migration surface by half and removes the highest-risk leg.

---

## 1. Today's state — the migration starts here

### 1.1 Auth surface
13 routes on `backend/src/modules/auth/auth.controller.ts`:

| Route | Today | After migration |
|---|---|---|
| `POST /auth/login` | Returns `{ accessToken, refreshToken, user }` in JSON body | Sets both as httpOnly cookies; body returns `{ user, requiresMfa }` only |
| `POST /auth/mfa/verify` | Returns `{ verified: true }` | After Sprint 4: same response, but the verify also issues the session cookies (currently the frontend re-uses the login-time tokens after MFA succeeds — which is a hole) |
| `POST /auth/refresh` | Takes `refreshToken` from body; returns new `accessToken` in body | Reads refresh cookie; rotates both cookies |
| `POST /auth/logout` | Returns `{ success: true }` — invalidation client-side only | Clears both cookies; revokes the refresh token in Redis denylist |
| `GET /auth/me` | Reads `Authorization` header | Reads access cookie |
| `POST /auth/change-password`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable` | Reads `Authorization` header | Reads access cookie |
| `POST /auth/magic-link/verify` | **NO CHANGE** — candidate flow | Stays token-in-body |
| `POST /auth/otp/send`, `POST /auth/otp/verify` | **NO CHANGE** — candidate flow | Stays token-in-body |
| `GET /auth/invitation/:token`, `POST /auth/invitation/accept` | **NO CHANGE** — one-time link flow | Stays token-in-body |

### 1.2 Backend infrastructure (already in place — half the prep is done)

- `cookie-parser` loaded in `main.ts:122` ✅
- CORS configured with `credentials: true` and an explicit origin allowlist ✅
- `helmet` strong defaults ✅
- `RedisService` exists with `setex` / `get` / `del` ✅ — needed for the refresh-token denylist on logout

### 1.3 Frontend touchpoints

- `frontend/portal/lib/api.ts` — axios instance, request interceptor reads `localStorage`, response interceptor does the 401 → refresh dance
- `frontend/portal/store/auth.store.ts` — Zustand store of `user` + tokens
- 9 files that directly call `localStorage.{get,set,remove}Item` for `accessToken` / `refreshToken`

### 1.4 What's not present and must be built
- A **CSRF token** mechanism (cookie sessions need this — `SameSite=Strict` helps but isn't sufficient against same-site sub-domain leaks)
- A **refresh-token denylist** for logout (today's logout is symbolic; with cookies we need real revocation)

---

## 2. Target architecture

### 2.1 Tokens
- **Access token cookie** — `ae_at`. `httpOnly`, `Secure` (in prod), `SameSite=Strict`, `Path=/api`, **15-minute** lifetime (matches the current JWT default).
- **Refresh token cookie** — `ae_rt`. `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth/refresh` (narrow path so only the refresh endpoint sees it), **7-day** lifetime.
- **CSRF token cookie** — `ae_csrf`. **NOT** httpOnly (frontend needs to read it). `SameSite=Strict`, regenerated on every refresh. Frontend sends its value back in the `X-CSRF-Token` request header on every state-changing request.

### 2.2 Refresh rotation
- Every successful refresh rotates **both** the access and refresh cookies (current implementation only rotates access).
- The previous refresh token is added to a Redis denylist with the same TTL as its original expiry — replay protection.
- On logout, the active refresh token is denylisted.

### 2.3 CSRF enforcement
- New middleware after `cookie-parser` that checks `X-CSRF-Token` header against `ae_csrf` cookie for **state-changing** requests (POST / PUT / PATCH / DELETE) on **authenticated** routes (skipped for the public candidate flow and `/auth/login`).
- Constant-time string compare so the verify itself doesn't leak via timing.

### 2.4 Strategy switch
- Replace `ExtractJwt.fromAuthHeaderAsBearerToken()` with a **custom extractor** that reads `req.cookies.ae_at` first, then falls back to the `Authorization` header (so the candidate magic-link flow, which still uses headers, keeps working).

---

## 3. Touchpoint inventory — exact files

### 3.1 Backend (10 files)

| File | Change | Risk |
|---|---|---|
| `backend/src/main.ts` | Register the new CSRF middleware. Confirm `cookie-parser` is BEFORE all controllers (it already is). | LOW |
| `backend/src/modules/auth/auth.controller.ts` | `login`, `refresh`, `logout` set/clear cookies; `getMe` continues to read `req.user` (Passport handles the cookie via the new strategy extractor) | MEDIUM — most behaviour change here |
| `backend/src/modules/auth/auth.service.ts` | Add `setAuthCookies(res, accessToken, refreshToken)`. `refreshToken` method rotates both tokens and writes to the denylist. New `revokeRefreshToken(jti)` method. | MEDIUM |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | Custom extractor reads cookie first | MEDIUM |
| `backend/src/common/middleware/csrf.middleware.ts` | NEW — verifies header against cookie | HIGH (gate on every mutation) |
| `backend/src/common/decorators/skip-csrf.decorator.ts` | NEW — exemption marker for public mutation routes | LOW |
| `backend/src/modules/auth/auth.module.ts` | Wire RedisService into auth | LOW |
| `backend/src/modules/quiz/quiz.controller.ts` | Mark public routes `@SkipCsrf` | LOW |
| `backend/src/modules/exam-delivery/exam-delivery.controller.ts` | Mark public routes `@SkipCsrf` | LOW |
| `backend/src/modules/sales/sales.controller.ts` | `SalesPublicController.createLead` gets `@SkipCsrf` | LOW |

### 3.2 Frontend (3 files)

| File | Change | Risk |
|---|---|---|
| `frontend/portal/lib/api.ts` | Drop the localStorage read in the request interceptor. The 401→refresh interceptor calls `/auth/refresh` (cookie carries it automatically) and retries the original request. Read `ae_csrf` cookie and attach to `X-CSRF-Token` header on POST/PUT/PATCH/DELETE. | HIGH |
| `frontend/portal/store/auth.store.ts` | Drop token state — store only `user`. Init by calling `/auth/me` instead of reading localStorage. | MEDIUM |
| Login + MFA pages (`app/login`, `app/cms/login`) | Stop reading tokens from the login response — only `user` is returned now. The cookies are set by the response itself. | MEDIUM |

### 3.3 Files that read localStorage tokens — replace with a single helper

All 9 files use `localStorage.getItem('accessToken')` or `refreshToken`. After migration:
- For the **portal pages** (admin/HR/proctor/etc): remove these reads entirely — the cookie auths automatically.
- For the **candidate pages** (exam, quiz, interview): keep the existing pattern unchanged (they use the magic-link token, separate flow).

I'll audit each one in execution; some may be using localStorage for unrelated state.

---

## 4. Feature flag + rollback design

The migration must be **deployable at zero downtime**. Strategy:

### 4.1 Phase 1 — Backend supports both (1 commit, can ship anytime)

- Add the cookie-setting code path to `login` / `refresh` / `logout`
- Keep returning `{ accessToken, refreshToken }` in the response body too
- JWT strategy reads cookie OR header (cookie takes precedence)
- CSRF middleware is **OFF** by default — gated on env `AUTH_COOKIES_ENFORCED=false`

State after Phase 1: cookies + tokens are both being issued. Frontend still uses tokens; cookies are dormant.

### 4.2 Phase 2 — Frontend switches to cookies (1 commit)

- Frontend reads/writes nothing in localStorage for auth
- Frontend reads `ae_csrf` cookie + sends `X-CSRF-Token` header

State after Phase 2: frontend on cookies. Backend still serves both. Logged-in users at the moment of deploy have a localStorage session that no longer works — they're prompted to log in once.

### 4.3 Phase 3 — Backend drops body tokens + enables CSRF enforcement (1 commit)

- Login response body shrinks to `{ user, requiresMfa }`
- `AUTH_COOKIES_ENFORCED=true` enables CSRF middleware
- Audit: any request to a state-changing route without a CSRF header is rejected with 403

### 4.4 Rollback paths

| Phase | If it breaks | Rollback |
|---|---|---|
| Phase 1 | Cookie issuance fails silently — frontend still on tokens, unaffected | Revert the commit |
| Phase 2 | Login broken for everyone on the new build | Revert frontend commit. Backend stays on Phase 1 (still issues tokens). Users on the previous frontend continue working. |
| Phase 3 | CSRF header missing somewhere | `AUTH_COOKIES_ENFORCED=false` env override flips the middleware off without a redeploy. Then fix and re-deploy. |

The **kill switch is `AUTH_COOKIES_ENFORCED=false`** — a single env-var change recovers the system without a code rollback.

---

## 5. Risks I have flagged

| Risk | Likelihood | Mitigation |
|---|---|---|
| **CORS + cookie domain mismatch** — production has `assessexpert.com` (root) and `app.assessexpert.com` (subdomain) potentially. Cookies set on root with `SameSite=Strict` won't carry to subdomain XHR. | MEDIUM | Audit prod domain layout BEFORE Phase 1 lands. If app + API live on different domains, plan changes (subdomain cookie + `SameSite=Lax`, or proxy through same origin). |
| **WebSocket auth** — the proctor / candidate gateways may use the JWT today. Cookies + ws upgrade can be quirky. | MEDIUM | Audit `backend/src/modules/gateway/` use of `req.headers.authorization` before Phase 2. If it reads the header, it still works; if it reads `req.user`, the cookie path covers it. |
| **Refresh-token Redis dependency** — if Redis is down, refresh works but denylist write fails silently. An attacker who steals a refresh token before logout could replay it. | LOW | RedisService already has in-memory fallback. Risk inherits the existing OTP-path risk profile. Document in deploy notes. |
| **CSRF middleware blocking the magic-link refresh endpoint** | LOW | `@SkipCsrf` decorator + early-return for the candidate routes. |
| **Stack trace + error messages** — login failures with the wrong content-type leak more information through cookie responses than they did through body responses | LOW | Standard NestJS exception filter already normalises error responses. |
| **Mobile candidate browsers** — iOS Safari has historically been strict about third-party cookies. | NOT APPLICABLE | Candidate flow stays on token-in-URL. Scope reduction at the top of this doc covers it. |

---

## 6. Test plan

### 6.1 Pre-deploy (local + CI)

- New unit tests for `setAuthCookies` (correct flags set: httpOnly, SameSite=Strict, Secure in prod)
- New unit tests for `refreshToken` rotation + denylist write
- New integration tests for the cookie-based login → me → logout flow
- Re-run all 28 existing tests; they should pass unchanged because token-in-body still works during Phase 1+2

### 6.2 Manual VPS smoke test (after Phase 1)

Curl-based:
```bash
# Login → cookies present in response
curl -i -c /tmp/jar -X POST https://assessexpert.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'

# Reuse the cookies on a protected route
curl -i -b /tmp/jar https://assessexpert.com/api/auth/me

# Refresh
curl -i -b /tmp/jar -c /tmp/jar -X POST https://assessexpert.com/api/auth/refresh

# Logout clears cookies
curl -i -b /tmp/jar -c /tmp/jar -X POST https://assessexpert.com/api/auth/logout
```

### 6.3 Manual browser test (after Phase 2)

- Login as Admin → confirm in DevTools that `ae_at` + `ae_rt` + `ae_csrf` cookies are set, no localStorage tokens
- Wait 15+ minutes → trigger a request → confirm silent refresh succeeded (cookies rotated)
- Logout → confirm cookies cleared
- Repeat for HR, proctor, master proctor, exam setup roles

### 6.4 Production sanity (after Phase 3)

- Verify CSRF rejection: send a POST to `/api/auth/change-password` without the `X-CSRF-Token` header → expect 403
- Verify candidate magic-link flow still works (no CSRF required for that path)

---

## 7. Execution sequence — when you say "go"

| Step | Commit | What gets done | Approx scope |
|---|---|---|---|
| 1 | Phase 1 backend | Add cookie-setting to login/refresh/logout, custom extractor in JwtStrategy, CSRF middleware gated OFF, `@SkipCsrf` decorator on public routes, new unit + integration tests | Backend only — frontend unchanged |
| 2 | (verify on VPS) | Deploy Phase 1, run §6.2 curl smoke test, confirm cookies issued correctly, no regressions | — |
| 3 | Phase 2 frontend | Strip localStorage token reads/writes, axios instance uses cookies + CSRF header, auth store drops tokens, login pages stop reading tokens from response | Frontend only — backend stays Phase 1 |
| 4 | (verify on VPS) | Deploy Phase 2, run §6.3 browser smoke test for each role, watch console for CSP / 401 cascades | — |
| 5 | Phase 3 backend | Remove tokens from login response body, set `AUTH_COOKIES_ENFORCED=true` default, CSRF middleware active | Backend only |
| 6 | (verify on VPS) | Run §6.4 production sanity, watch pm2 logs for unexpected 403s | — |

**Between each step I will stop and report.** No surprise deploys; no chaining commits without explicit confirmation between phases.

---

## 8. What this plan does NOT do

- Doesn't touch the candidate magic-link flow (`/exam`, `/quiz`, `/interview`). Those remain token-in-URL.
- Doesn't change WebSocket auth (the gateway uses `req.user` populated by the existing JWT guard — cookie path covers it transparently).
- Doesn't add account-lockout or device-binding. Those are separate hardening tasks.
- Doesn't migrate the password-reset link to cookies — those are one-time tokens, same as invitations.
- Doesn't introduce a separate auth service. The migration stays inside the existing `AuthModule`.

---

## 9. Estimated effort

- Phase 1 backend: 1 focused day
- Phase 2 frontend: half a day
- Phase 3 enforcement: 2 hours + a week of monitoring

Total: **2 days of work + ~1 week of feature-flag burn-in** before flipping enforcement. Less than the SAST report's original "2-3 days" estimate because the cookie-parser + CORS infra is already in place.

---

## 10. Approval gate

This file represents the contract. Before I execute Phase 1, please confirm:

1. The scope reduction (candidate flow stays on tokens) is correct
2. The 3-phase rollout with `AUTH_COOKIES_ENFORCED` kill switch is acceptable
3. You have a maintenance window or a window of low traffic for Phase 2 (the moment the frontend bundle ships, everyone's existing session may need re-login)
4. The production domain layout is **single-origin** (assessexpert.com both serves the app and the API) — if not, flag it now because cookie scope changes

When you confirm, I'll execute step 1 (Phase 1 backend) and stop for your verification before continuing.
