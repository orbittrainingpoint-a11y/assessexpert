# Deploy Runbook

Pulls the latest, rebuilds, and restarts the running services. Assumes a
standard PM2 + Apache layout on a Linux VPS.

## Prerequisites (one-time)

- `backend/.env` populated from `backend/.env.example` (see "Required env"
  below)
- `frontend/portal/.env.production` populated
- Cloudflare TURN keys minted (see GAPS.md G7 if you also want retries)
- coturn TLS cert configured (`/etc/letsencrypt/live/turn.assessexpert.com/`)
- `/etc/apache2/sites-enabled/turn-acme.conf` present so cert renewals
  don't break (see BUGS.md M1)

## Standard deploy

```bash
# 1. Pull the latest
cd /var/www/html/assessexpert
git pull origin main

# 2. Backend
cd backend
npm ci
npx prisma migrate deploy        # apply any pending migrations
npx prisma generate              # regen client to match schema
npm run build
pm2 restart assessexpert-backend --update-env

# 3. Frontend (portal)
cd ../frontend/portal
npm ci
rm -rf .next                     # clear stale Turbopack cache
npm run build
pm2 restart 10 --update-env      # 10 is the assessexpert-frontend id; check pm2 ls

# 4. Smoke check
curl -fsS https://assessexpert.com/api/health
curl -fsS https://assessexpert.com/api/turn/credentials | head -c 200
```

Open `https://assessexpert.com/__status` in a browser — all six checks
should be green.

## Hard refresh users after deploy

Next.js fingerprints chunks but the HTML shell stays cached. After every
deploy, users on tabs that don't refresh see the old bundle until they
hard-reload (Ctrl+Shift+R). Tracked as BUGS H3 — for now, post the
deploy + ask anyone in an active session to refresh.

## Cert renewal (auto)

Let's Encrypt renews via certbot's systemd timer. We have a deploy hook
at `/etc/letsencrypt/renewal-hooks/deploy/coturn-reload.sh` that
restarts coturn so it picks up the new key/cert.

## Required env

### Backend (`backend/.env`)

See `backend/.env.example` for the full list. Critical values:

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — ≥32 chars, generated with `openssl rand -hex 32`
- `JWT_REFRESH_SECRET` — ≥32 chars, MUST differ from `JWT_SECRET`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — outbound email
- `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` — Cloudflare TURN
- `FRONTEND_URL` — base URL used in magic-link emails
- `STORAGE_PATH` — where uploaded files live (reference photos,
  recordings)

### Frontend (`frontend/portal/.env.production`)

- `NEXT_PUBLIC_API_URL=https://assessexpert.com/api`
- `NEXT_PUBLIC_WS_URL=https://assessexpert.com`
- `NEXT_PUBLIC_TURN_SERVER=turn.assessexpert.com`
- `NEXT_PUBLIC_TURN_SECRET=<coturn long-term password>`
- `NEXT_PUBLIC_APP_NAME=assessexpert`
- `NEXT_PUBLIC_MEDIAPIPE_ENABLED=true`

Note: `NEXT_PUBLIC_*` are baked into the JS bundle at build time. A
restart alone won't pick up changes — you must rebuild.

## Rollback

```bash
# Identify the previous good commit
cd /var/www/html/assessexpert
git log --oneline -5

# Roll back the codebase
git reset --hard <prev-sha>

# Re-build + restart
cd backend && npm run build && pm2 restart assessexpert-backend --update-env
cd ../frontend/portal && rm -rf .next && npm run build && pm2 restart 10 --update-env
```

Prisma migrations are NOT rolled back by git. If you need to undo a
migration, write a new "down" migration. Recent migrations
(interview_fields, slot_duration, cms_models) only add columns/tables —
leaving them applied with a code rollback is safe.

## Common gotchas

- **`pm2 restart` without `--update-env`** doesn't pick up new `.env`
  values. Always pass the flag after editing env files.
- **Next.js cache (`.next/dev/types/routes.d.ts:78:23 — ';' expected`)
  errors** — `rm -rf .next` before `npm run build`.
- **Broken Apache vhost symlinks** (e.g. `orbit-system.conf` in
  `sites-enabled` pointing nowhere) crash `apache2ctl configtest`. Run
  `find /etc/apache2/sites-enabled -xtype l` to find them.
- **`apt update` 404 on `extreme-ix` mirror** — that mirror went dead;
  comment out `/etc/apt/sources.list.d/ubuntu-mirrors.list`.

## Process names

```text
pm2 ls
# 0  rest-express             cluster   …
# 1  lmsorbit                 fork      …
# 2  elissh-backend           cluster   …
# 3  orbit-training           fork      …
# 4  assessexpert-backend     fork      ← us
# 10 assessexpert-frontend    fork      ← us
# 11 wattsstore-api           fork      …
# 12 wattsstore-web           fork      …
# 13 minio                    fork      …
```

Only restart 4 and 10. Other apps share the VPS but are independent.
