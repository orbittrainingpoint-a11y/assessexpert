---
name: run-assessexpert
description: Build, launch, and smoke-test the AssessExpert assessment platform (NestJS backend on :4000 + Next.js portal on :3000). Use when asked to run, start, boot, build, serve, smoke-test, or verify AssessExpert locally, or check that the backend API / candidate exam / proctor portal actually comes up.
---

# Run AssessExpert

AssessExpert is a two-binary app: a **NestJS backend** (`backend/`, port 4000,
Swagger at `/api/docs`) and a **Next.js 16 portal** (`frontend/portal/`, port
3000). They share one Postgres DB. The agent path is the driver
`.claude/skills/run-assessexpert/driver.mjs` — it builds the backend, boots it,
and asserts the live HTTP surface (Swagger up, real super-admin login → JWT,
authenticated `/me`, unauthenticated 401), then optionally boots the frontend
and checks it serves the login + candidate-exam pages.

All paths below are relative to the unit root `assessexpert/`. Everything here
was run on Windows (PowerShell + Git-Bash), Node 24, Postgres 18.

## Prerequisites

- **Node 24**, npm 11.
- **PostgreSQL** running on `localhost:5432` with the DB/role from
  `backend/.env` (`DATABASE_URL`). Confirm: `pg_isready -h 127.0.0.1 -p 5432`.
- **`backend/.env` must exist** with a real `JWT_SECRET` and `JWT_REFRESH_SECRET`
  (≥32 chars each) — the backend **refuses to boot** otherwise (hard exit in
  `backend/src/main.ts`). The committed dev `.env` already satisfies this.
- Redis is optional — the backend falls back to in-memory if `REDIS_URL` is
  unset (see Gotchas).
- No browser is needed for the driver. A full GUI screenshot would need
  Chromium/Playwright, which is **not** installed here (see Gotchas).

## Build

```bash
# Backend: deps (regenerates Prisma client via postinstall), then migrate, then build.
cd backend
npm install
npx prisma migrate deploy        # applies pending migrations to the local DB
npm run build                    # nest build -> dist/src/main.js
cd ..

# Frontend: deps THEN build. npm install is not optional after a git pull —
# a missing dep (e.g. isomorphic-dompurify) fails the build with
# "Module not found", not a warning.
cd frontend/portal
npm install
npm run build                    # next build
cd ../..
```

## Run (agent path) — the driver

From the unit root:

```bash
# Backend only: build, boot, run the HTTP smoke, tear down. Exit 0 = pass.
node .claude/skills/run-assessexpert/driver.mjs

# Backend + frontend serve check (frontend must be built first — see Build):
node .claude/skills/run-assessexpert/driver.mjs --no-build --frontend

# Leave servers running after a green smoke (Ctrl-C to stop):
node .claude/skills/run-assessexpert/driver.mjs --keep
```

Flags: `--no-build` skips `nest build` (dist must exist), `--frontend` also
boots/checks the portal, `--keep` leaves servers up on success. Env overrides:
`BACKEND_PORT`, `FRONTEND_PORT`, `LOGIN_EMAIL`, `LOGIN_PASSWORD` (default to the
demo super-admin `admin@assessexpert.ae`).

Expected output (verified this session):

```
[smoke] backend HTTP surface
  ✓ GET /api/docs -> 200
  ✓ POST /api/auth/login -> 200 (JWT, role=SUPER_ADMIN)
  ✓ GET /api/auth/me -> 200 (admin@assessexpert.ae)
  ✓ GET /api/auth/me (no token) -> 401
[smoke] frontend serve
  ✓ GET /login -> 200 (renders Sign In)
  ✓ GET /exam?token=... -> 200
=== SMOKE PASSED ===
```

The driver assumes the DB is up and migrated — it does **not** migrate for you,
because that mutates the dev database (run `npx prisma migrate deploy` yourself,
as in Build).

## Drive it by hand (curl)

If you only need to poke the API, boot the backend and curl it directly — this
is what the driver automates:

```bash
cd backend && node dist/src/main &       # boots on :4000

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/docs   # 200

TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@assessexpert.ae","password":"Admin@assessexpert2026!"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).accessToken))')

curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN"  # profile JSON
```

153 routes are mapped; browse them all at `http://localhost:4000/api/docs`
(Swagger is dev-only — disabled when `NODE_ENV=production`).

## Run (human path)

`start-dev.bat` (Windows) opens two terminals: backend `npm run start:dev`
(watch) on :4000, frontend `npm run dev` on :3000, after running
`prisma generate` + the `seed-ahmed.ts` demo seed. Useful for interactive
work; not for headless verification. Demo logins are printed by the batch
file (super-admin, master-proctor, proctor, HR, etc.; candidate magic link
`/exam?token=DEMO-AHMED-2026-ACAD-L1-TOKEN`, dev OTP bypass `000000`).

For production deploy (VPS, PM2, Apache), see `DEPLOY.md` — not this skill.

## Gotchas

- **`npm install` after every `git pull` is mandatory, not optional.** A new
  dependency added to `package.json` but absent from `node_modules` fails
  `next build` with `Module not found: Can't resolve '<pkg>'` — this is exactly
  how the frontend build broke on the VPS (`isomorphic-dompurify`). The fix is
  always `npm install`, never a code change.
- **Backend dist entrypoint is `dist/src/main.js`, not `dist/main.js`** — the
  `npm start` script is `node dist/src/main`. Don't guess `dist/main`.
- **Backend hard-exits without good JWT secrets.** If `JWT_SECRET` /
  `JWT_REFRESH_SECRET` are missing or <32 chars, you get `[FATAL] JWT_SECRET is
  missing or too short` and exit 1 — it's not a crash, it's a guard.
- **`document is not defined` from MediaPipeService on boot is expected.** The
  face-detection models are browser-oriented; server-side it logs the error and
  runs in "fallback mode". Not a failure.
- **Redis falls back to in-memory even when Redis is running.** The code keys
  off `REDIS_URL`; `backend/.env` only sets `REDIS_HOST`/`REDIS_PORT`, so you'll
  see `REDIS_URL not set — using in-memory fallback`. Fine for local dev.
- **The unauthenticated `/me` 401 prints an `UnauthorizedException` stack** to
  the backend log. That's Nest logging the rejection we asked for — the smoke
  treats 401 as a pass.
- **Two `package-lock.json` files exist** (`frontend/portal/` and an outer one),
  so `next build` warns it "inferred your workspace root." Run `npm install`
  from inside `frontend/portal/` so it resolves against the correct lockfile.
- **No browser here → no GUI screenshot.** The driver verifies the frontend
  *serves* (HTTP 200 + rendered markers), not a clicked-through flow. Driving
  the proctor/candidate UI end-to-end (camera, WebRTC, checklist) needs
  Chromium + Playwright installed, which this machine lacks.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `next build` → `Module not found: Can't resolve '...'` | `cd frontend/portal && npm install`, then rebuild. A dep is in `package.json` but not installed. |
| Backend exits with `[FATAL] JWT_SECRET ...` | `backend/.env` is missing/short secrets. Use the committed dev `.env` or `npm run generate:secrets`. |
| `prisma migrate status` says migrations not applied | `cd backend && npx prisma migrate deploy`. |
| Login smoke returns no token (login → 401/500) | DB not seeded. Run the demo seed (`npx ts-node prisma/seed-ahmed.ts`) or `npm run prisma:seed`. |
| Driver hangs on "backend did not respond" | Port 4000 already in use. Kill the stale process (`netstat -ano \| grep :4000`, then `taskkill /PID <pid> /F`) and retry. |
| `migrate deploy` reports drift | See `DEPLOY.md` → "Drift recovery". |
