# Deploying AssessExpert

Quick reference for the VPS deploy flow. Read once, bookmark, never
read again.

## TL;DR — Every deploy

From the repo root on the VPS:

```bash
git pull origin main

# Backend: install + prisma check + migrate + build + pm2 reload
cd backend
npm run deploy

# Frontend: rebuild + reload
cd ../frontend/portal
npm install
npm run build
pm2 reload assessexpert-frontend --update-env
```

`backend/npm run deploy` runs `scripts/deploy.sh` which:
- Installs deps (postinstall regenerates the Prisma client).
- Runs `prisma migrate status` and **aborts on drift** — no more
  silent corruption.
- Applies pending migrations.
- Builds dist and reloads pm2.

If the deploy script reports drift, see "Drift recovery" below.

## First-time setup on a fresh VPS

### 1. System prerequisites

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm git postgresql nginx chromium-browser \
    fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 libxss1 \
    libasound2 libgbm1 libxshmfence1
sudo npm install -g pm2
```

The `chromium-browser` + libs are needed by Puppeteer for the
report PDF generation (Batch 3). Set `PUPPETEER_EXECUTABLE_PATH`
in `backend/.env` if you want to use the system Chromium instead of
the bundled one.

### 2. PostgreSQL

```bash
sudo -u postgres createuser --interactive   # name=assessexpert, superuser=no
sudo -u postgres createdb assessexpert -O assessexpert
sudo -u postgres psql -c "ALTER USER assessexpert WITH PASSWORD 'CHANGE-ME';"
```

`DATABASE_URL` in `backend/.env`:
```
DATABASE_URL=postgresql://assessexpert:CHANGE-ME@localhost:5432/assessexpert
```

### 3. Storage directory

```bash
sudo mkdir -p /var/lib/assessexpert/storage
sudo chown -R $USER:$USER /var/lib/assessexpert
```

Then in `backend/.env`:
```
STORAGE_PATH=/var/lib/assessexpert/storage
```

This is where reference photos, FR captures, paper-set files, session
recordings, and rendered PDFs all land.

### 4. Required env vars

`backend/.env`:
```
# IMPORTANT: append connection_limit + pool_timeout to DATABASE_URL.
# Prisma's default pool size is num_cpus * 2 + 1 — on a small VPS that
# comes out to 5-9 connections, which gets exhausted the moment a
# dashboard fires several parallel queries (the master-proctor home
# page alone runs 5 useQuery calls in parallel). connection_limit=20
# is comfortable for modest production traffic; raise further only if
# you actually see pool-timeout errors after this.
DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/DB?connection_limit=20&pool_timeout=20
JWT_SECRET=...                   # long random
JWT_REFRESH_SECRET=...           # long random
FRONTEND_URL=https://app.assessexpert.com
STORAGE_PATH=/var/lib/assessexpert/storage

# SMTP for OTP + invitation + report-published emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=...
SMTP_FROM=AssessExpert <noreply@yourdomain.com>

# Gemini powers the AI report narrative AND the verification transcript.
# Without this, both degrade silently to "AI unavailable".
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash               # used by report narrative
GEMINI_TRANSCRIBE_MODEL=gemini-1.5-flash    # used by verification transcript

# Optional: point Puppeteer at the system Chromium if the bundled
# download failed during npm install
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

`frontend/portal/.env.production`:
```
NEXT_PUBLIC_API_URL=https://api.assessexpert.com
NEXT_PUBLIC_WS_URL=https://api.assessexpert.com
NEXT_PUBLIC_TURN_SECRET=...   # see deploy/turn/README.md
```

### 5. Initial migration + start

```bash
cd backend && npm run deploy
cd ../frontend/portal && npm install && npm run build

# From repo root:
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # run the one-time bootstrap line it prints
```

### 6. Nightly DB backup cron

Wire `backend/scripts/backup-db.sh` to cron once per VPS. Reads
`DATABASE_URL` from `backend/.env`, writes `.sql.gz` files to
`/var/backups/assessexpert/`, keeps 14 days by default.

```bash
# Make sure the backup dir exists and is writable by the cron user
sudo mkdir -p /var/backups/assessexpert
sudo chown $USER /var/backups/assessexpert

# Edit cron for the user running the app:
crontab -e

# Add (runs nightly at 02:30 server time):
30 2 * * * /home/ubuntu/assessexpert/backend/scripts/backup-db.sh >> /var/log/assessexpert-backup.log 2>&1
```

Restore from a snapshot:
```bash
gunzip -c /var/backups/assessexpert/2026-05-19_0230.sql.gz \
  | psql "$DATABASE_URL"
```

Override defaults via env if needed: `BACKUP_DIR=/mnt/somewhere
RETENTION_DAYS=30 ./backup-db.sh`.

## Prisma connection-pool exhaustion

Symptom in logs after a user opens a busy dashboard:

```
Invalid `prisma.user.findUnique()` invocation:
Timed out fetching a new connection from the connection pool.
Current connection pool timeout: 10, connection limit: 9
```

The default Prisma pool is `num_physical_cpus * 2 + 1` — 5-9 on a
small VPS. The master-proctor home page fires 5+ parallel useQuery
calls; add the WebSocket handshake + /auth/me + a refresh-poll and
the pool runs dry.

**One-line fix on the VPS:**

```bash
# Edit backend/.env and append these query params to DATABASE_URL:
#   ?connection_limit=20&pool_timeout=20
nano backend/.env
pm2 reload assessexpert-backend --update-env
```

Postgres `max_connections` defaults to 100 so 20 is well within
budget. Bump higher only if you actually see the error again.

## Drift recovery

`prisma migrate status` reports drift when the database schema doesn't
match what Prisma expects. This usually happens after:

- A migration was applied manually but never marked as such.
- A previous failed migration left partial changes.
- Someone edited the schema directly in psql.

Standard recovery:

1. **Identify the affected migration**. The `migrate status` output
   names it.
2. **If the migration's SQL is partially applied**, finish it manually
   in psql (the migration's `migration.sql` file is your reference).
3. **Mark it as applied** so Prisma stops complaining:
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```
4. Re-run `npm run deploy`.

If you're not sure what's in the database vs. what's in `schema.prisma`,
`npx prisma db pull` will write the current DB shape into the schema
file (DESTRUCTIVE of local edits — back up first).

## Subsystems

| Subsystem | Where | Notes |
|---|---|---|
| TURN/STUN | `deploy/turn/README.md` | Optional but strongly recommended for candidates behind corporate firewalls. |
| Jitsi (deprecated) | `deploy/jitsi/README.md` | Earlier video stack; current build uses pure WebRTC via `lib/useJitsi.ts` (despite the name). |
| Apache reverse proxy | Configured manually on the VPS | `/etc/apache2/sites-enabled/api.conf` proxies to `localhost:4000` with WebSocket upgrade. |
| Recording retention | Backend cron, daily 3 AM | `recordings.service.ts:purgeExpiredRecordings`. Drops recordings >7 days old. |
| Email health | `GET /notifications/email-health` | SUPER_ADMIN only. Surfaces recent SMTP failures. |
| Prisma Studio | `npx prisma studio --port 5555` + SSH tunnel | See deploy/turn for the SSH tunnel pattern. |

## Disk usage forecast

Per typical 90-minute multi-candidate session:
- Webcam recording: ~330 MB
- Screen recording: ~330 MB
- FR captures (~45 frames): ~10 MB
- Reference photo: ~50 KB
- Reports/PDFs: ~200 KB

≈ **700 MB / session**. With 7-day retention purging recordings and
20 sessions/day:
- Active storage steady state: ~100 GB
- Allocate at least 200 GB on the VPS.
