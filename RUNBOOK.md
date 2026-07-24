# Incident Runbook

Playbook for the most common "something is broken in production" scenarios. Each entry: symptom → diagnose → fix → verify. Keep updated when new failure modes appear.

**VPS access:** `ssh root@mail`
**Production app:** https://assessexpert.com
**Backend location:** `/var/www/html/assessexpert/backend`
**Frontend location:** `/var/www/html/assessexpert/frontend/portal`
**pm2 processes:** `assessexpert-backend` (id 4), `assessexpert-frontend` (id 10)

---

## Contents

1. [Backend is down / crash-looping](#1-backend-is-down--crash-looping)
2. [Login returns 503](#2-login-returns-503)
3. [Login returns 401 for a valid password](#3-login-returns-401-for-a-valid-password)
4. [Prisma migration fails](#4-prisma-migration-fails)
5. [Emails aren't sending](#5-emails-arent-sending)
6. [CMS pages / blog posts show 404](#6-cms-pages--blog-posts-show-404)
7. [git pull refuses (merge conflict)](#7-git-pull-refuses-merge-conflict)
8. [DB password auth fails but backend seems to work](#8-db-password-auth-fails-but-backend-seems-to-work)
9. [Sitemap URLs don't match host (Google rejects)](#9-sitemap-urls-dont-match-host)
10. [Free-disk exhausted](#10-free-disk-exhausted)
11. [High memory / OOM](#11-high-memory--oom)
12. [Rollback the last deploy](#12-rollback-the-last-deploy)

---

## 1. Backend is down / crash-looping

**Symptom:** `https://assessexpert.com/api/health` returns 502/503, or pm2 shows the restart counter climbing fast.

**Diagnose:**
```bash
pm2 status | grep assessexpert-backend
# Is status 'errored' or 'stopped'? Is restart count high?

pm2 logs assessexpert-backend --err --lines 100 --nostream
# Read the last error stack trace
```

**Fix — categorised by what the error says:**

- `Cannot find module 'X'` → dep missing. `cd backend && npm install X && npm run build && pm2 restart assessexpert-backend --update-env`. See recent incident with `body-parser` (fix commit `4d022b8`).
- `Prisma: Cannot find module '@prisma/client'` → run `npx prisma generate && npm run build && pm2 restart`.
- `P1000` (Prisma auth) → jump to section [8](#8-db-password-auth-fails-but-backend-seems-to-work).
- `Port already in use` → orphaned node process. `pkill -f "node dist/src/main"` then restart pm2.
- NestJS DI error (`Cannot resolve dependency`) → recent breaking change in a module. Roll back to previous commit: see [12](#12-rollback-the-last-deploy).
- Other → paste last 50 error lines to devs.

**Verify:**
```bash
curl -sI http://localhost:4000/api/health | head -1  # expect HTTP/1.1 200 OK
pm2 logs assessexpert-backend --lines 20 --nostream | grep "Nest application successfully started"
```

---

## 2. Login returns 503

Not a credential problem — 503 = backend unreachable. Follow section [1](#1-backend-is-down--crash-looping).

If backend is up per `curl -sI http://localhost:4000/api/health` = 200, then it's Apache/Nginx proxy:
```bash
tail -50 /var/log/apache2/error.log | grep -i "proxy\|assessexpert\|503"
sudo systemctl reload apache2
```

---

## 3. Login returns 401 for a valid password

**Diagnose in order:**

```bash
# a) Does the user actually exist and is ACTIVE?
PGPASSWORD="$(grep DATABASE_URL /var/www/html/assessexpert/backend/.env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')" \
  psql -U assessexpert_app -h localhost -d assessexpert \
  -c "SELECT id, email, role, status, \"deletedAt\" FROM \"User\" WHERE email = 'user@example.com';"
# INACTIVE / SUSPENDED / DELETED / no row = expected 401.
```

- If no row → the user was never created, or was hard-deleted (soft delete only sets status).
- If `status = 'DELETED'` → soft-deleted. Cannot log in. Restore via `UPDATE "User" SET status='ACTIVE', "deletedAt"=NULL WHERE email='...'`.
- If `status = 'INACTIVE'` → admin needs to Reactivate on the /admin/users page.
- If `status = 'ACTIVE'` and it still 401s → the password on the row doesn't match what the user typed. Send them a password reset via the admin UI ("Reset link" button).

**MFA-locked-out user:**
- If user hit the MFA rate limit (5 failed attempts in 15min) they'll see "Too many failed MFA attempts" — wait 15 min or clear the Redis key: `redis-cli DEL "mfa:fail:<userId>"`.

---

## 4. Prisma migration fails

**`P1000` — auth failed:** see section [8](#8-db-password-auth-fails-but-backend-seems-to-work).

**`P3005` — non-empty schema without a baseline:** the DB has manual changes that don't match the migration history. Apply the SQL manually:
```bash
psql "$DATABASE_URL" -f prisma/migrations/<name>/migration.sql
# Then mark it applied in _prisma_migrations so future migrations don't redo it
psql "$DATABASE_URL" -c "INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (gen_random_uuid()::text, 'manual', '<migration_name>', NOW(), NOW(), 1);"
```

**`Migration <name> is a duplicate`:** the migration ran before but Prisma re-detected it. Clean via `DELETE FROM _prisma_migrations WHERE migration_name = '<name>';` then re-run.

---

## 5. Emails aren't sending

**Diagnose:**
```bash
# 1. Backend logs for send failures
pm2 logs assessexpert-backend --lines 200 --nostream | grep -i "email\|smtp\|nodemailer"

# 2. SMTP config
grep -E "^SMTP_" /var/www/html/assessexpert/backend/.env

# 3. Test SMTP directly
cd /var/www/html/assessexpert/backend && npm run test:smtp
```

**Common causes:**
- Wrong SMTP_PASS after Gmail app-password rotation → regenerate + update .env → restart backend
- Gmail 500-emails/day cap hit → check with Google Workspace admin, or migrate to SendGrid/Postmark
- Recipient email invalid / bouncing → check delivery status in Gmail sent-folder
- Backend running against stale SMTP env → `pm2 restart --update-env`

---

## 6. CMS pages / blog posts show 404

**Symptom:** `/api/cms/public/pages/home` returns 404, marketing site shows "No articles yet" on /blog.

**Cause:** CmsPage / CmsPost rows missing from DB (fresh DB, restored backup that predates the seed, etc.)

**Fix:**
```bash
cd /var/www/html/assessexpert/backend
npm run cms:seed
# Expected: "Blog posts: 0 created, 30 updated" (or "30 created" if truly missing)

# Force frontend to drop its ISR cache
pm2 restart 10 --update-env
```

**Verify:**
```bash
curl -s https://assessexpert.com/api/cms/public/posts | grep -o '"slug":' | wc -l
# expect 30
```

---

## 7. git pull refuses (merge conflict)

Almost always caused by local edits to `backend/package-lock.json` from a prior `npm install`.

**Fast fix:**
```bash
cd /var/www/html/assessexpert

# Stash the drifted lockfile
git stash push -m "vps-pre-pull-$(date +%F)" backend/package-lock.json

git pull origin main
git submodule update --remote --merge
```

**If a real code conflict appeared:**
```bash
git status                                        # see what conflicted
git checkout --theirs <file>                      # take the remote version
git add <file>
git commit -m "merge: take remote for <file>"
```

**Permanent fix (do once):** regenerate `backend/package-lock.json` on Linux and commit, then `npm ci` works everywhere and the drift stops.

---

## 8. DB password auth fails but backend seems to work

**Symptom:** `prisma migrate deploy` returns `P1000` but pm2 shows backend "online" and mapping routes.

**Cause:** Nest maps routes at boot without hitting DB. Prisma is lazy — connection happens on first query. The backend "runs" but every DB-touching request 500s. Meanwhile pm2's cached env may differ from `.env`.

**Diagnose:**
```bash
# Compare what pm2 thinks vs what .env says
pm2 env 4 | grep DATABASE_URL     # what pm2 has (may be empty — normal, Nest reads .env)
grep DATABASE_URL /var/www/html/assessexpert/backend/.env

# Test the .env password
PGPASSWORD='<password-from-env>' psql -U assessexpert_app -h localhost -d assessexpert -c 'SELECT 1;'
```

**Fix:** reset the DB user's password to match `.env`, OR update `.env` with the DB's actual password. See `SECRETS_MANAGEMENT.md` §3.2.

---

## 9. Sitemap URLs don't match host

**Symptom:** Google Search Console: "URL not allowed" on every sitemap entry.

**Cause:** `SITE.url` (frontend `lib/marketing-content.ts`) generates URLs on a domain different from the one the sitemap is served from.

**Fix:**
```bash
# On the VPS
grep NEXT_PUBLIC_SITE_URL /var/www/html/assessexpert/frontend/portal/.env.production
# Should equal the domain you verified in GSC (e.g. https://assessexpert.com)

# If missing or wrong:
echo 'NEXT_PUBLIC_SITE_URL=https://assessexpert.com' >> /var/www/html/assessexpert/frontend/portal/.env.production

cd /var/www/html/assessexpert/frontend/portal
rm -rf .next && npm run build && pm2 restart 10 --update-env

# Then re-submit in GSC
```

---

## 10. Free-disk exhausted

**Symptom:** backend errors like `ENOSPC`, pm2 can't write logs, uploads fail.

**Diagnose + clean:**
```bash
df -h                            # confirm root partition is full
du -sh /var/www/html/assessexpert/backend/storage/*
du -sh /root/.pm2/logs

# Common offenders:
# 1. pm2 logs — safe to truncate
pm2 flush

# 2. Old exam recordings past retention
ls -lah /var/www/html/assessexpert/backend/storage/recordings | wc -l
# Manual purge (respects RECORDING_RETENTION_DAYS env)
find /var/www/html/assessexpert/backend/storage/recordings -type f -mtime +7 -delete

# 3. Old backups
ls -lah /var/www/html/assessexpert/backups/  # or wherever backup-db.sh writes
```

---

## 11. High memory / OOM

**Symptom:** pm2 killing processes due to `maxMemoryRestart`, or Ubuntu OOM-killer logs in `dmesg`.

**Diagnose:**
```bash
pm2 monit                       # live per-process memory
free -h
dmesg | tail -50 | grep -i "killed process"
```

**Fix:**
- Restart the offender: `pm2 restart <name> --update-env`
- If a specific process leaks, spawn puppeteer/tfjs/mediapipe processes have known heavy footprints — check they're not spawning per-request without cleanup
- Long-term: set `pm2 start --max-memory-restart 1G` so restarts happen before OOM

---

## 12. Rollback the last deploy

If a fresh deploy broke something:

```bash
cd /var/www/html/assessexpert
# See the last few commits — find the last known good
git log --oneline -10

# Roll the submodule back to a specific known-good commit
git checkout <known-good-hash> -- assessexpert

# Then rebuild
cd backend && npm install && npm run build
cd ../frontend/portal && npm install && rm -rf .next && npm run build

pm2 restart assessexpert-backend assessexpert-frontend --update-env

# Note: if the broken deploy included a migration, you may need to
# manually reverse it via SQL. Migration files are one-way in this
# codebase (no `down.sql`). Check what the migration did and reverse.
```

**Emergency escape:** if all else fails, `pm2 stop assessexpert-backend` and put up a maintenance page (Apache can serve a static "back soon" HTML). Better to be down than corrupted.

---

## Escalation

Order of who to call:
1. On-call developer with commit access
2. Anthropic Claude Code session (recover context from git log + these docs)
3. Read `SECRETS_MANAGEMENT.md`, `SAST_REPORT.md`, `CODEBASE_ANALYSIS.md`, `GAPS_ANALYSIS.md` for design rationale on any suspicious area
