# AssessExpert — New Server Deploy Runbook

One-shot provisioning for AssessExpert on a **fresh Ubuntu 24.04 LTS VPS**.

The provisioner in [`provision-new-server.sh`](provision-new-server.sh) is designed to be run once as root on a brand-new box. It installs the whole stack, creates the database, writes real (locally-generated) secrets, builds both apps, and turns on HTTPS. Idempotent — safe to re-run if a step fails.

---

## Before you SSH in

1. **DNS.** Point these A records at the new server's public IP:
   - `assessexpert.com` → new IP
   - `www.assessexpert.com` → new IP

   Certbot (step 11 of the script) needs DNS resolving here or it will fail. If DNS isn't ready yet, the rest of the stack still comes up on HTTP — you re-run just the certbot step later.

2. **SSH key.** Have your SSH public key on the new box (`ssh-copy-id root@NEW_IP`), or provider-injected. Password auth over the internet is a bad idea.

3. **Sizing.** Minimum comfortable spec is **4 GB RAM / 2 vCPU / 40 GB disk**. Below 2 GB the frontend build (Turbopack) OOMs — the script adds 2 GB of swap to compensate, but real RAM is faster.

---

## Deploy

Two commands. That's it.

```bash
# 1. SSH in as root
ssh root@NEW_IP

# 2. Fetch and run the provisioner
wget -O provision.sh https://raw.githubusercontent.com/orbittrainingpoint-a11y/assessexpert/main/deploy/provision-new-server.sh
chmod +x provision.sh
./provision.sh
```

The script is loud — every step announces itself with a `▶`/`✓`/`!` marker. Expected wall time on a 4 GB / 2 vCPU box: **25–35 minutes**, with the frontend build dominating (~20 min).

If a step errors, fix the underlying cause and re-run the same script. Every step guards against re-runs (`\gexec` for DB, `-if [ ! -f ]` for secrets, `pm2 describe` for processes, `certbot --keep-until-expiring` for TLS).

---

## What the script leaves you with

| Path                                            | What                                                 |
|-------------------------------------------------|------------------------------------------------------|
| `/var/www/html/assessexpert`                    | The repo, checked out to `main`                      |
| `/var/www/html/assessexpert/backend/.env`       | Backend env — real DB password + real JWT secrets    |
| `/var/www/html/assessexpert/frontend/portal/.env.production` | Frontend env (baked into build)           |
| `/var/log/assessexpert/{backend,frontend}-{out,err}.log` | PM2 log files                              |
| `/etc/nginx/sites-enabled/assessexpert.conf`    | Nginx vhost (symlinked from repo)                    |
| `/etc/letsencrypt/live/assessexpert.com/`       | TLS cert + key (auto-renews)                         |
| `/root/.assessexpert-db-password`               | 40-char DB password (mode 600, root-only)            |
| `/root/.assessexpert-jwt-secret`                | 64-char hex JWT signing key (mode 600)               |
| `/root/.assessexpert-jwt-refresh-secret`        | 64-char hex refresh key (mode 600, distinct)         |

The three files under `/root/` are why re-running the script does not rotate secrets. **If you ever need to rotate**: delete the relevant file, re-run the provisioner. It will regenerate that secret, rewrite `backend/.env`, and PM2 reload the backend.

---

## Right after the provisioner finishes

Two things it can't do for you:

### 1. SMTP credentials

```bash
nano /var/www/html/assessexpert/backend/.env
# Fill in: SMTP_USER, SMTP_PASS, SMTP_FROM
pm2 reload assessexpert-backend --update-env
```

Without SMTP: magic-link candidate invitations, password reset, and email OTP won't send. The rest of the app runs fine.

### 2. Seed a super-admin account

The provisioner runs `prisma/seed-cms.ts` (CMS pages) but NOT the user seed (which would inject known credentials into the DB). Bootstrap your first admin yourself:

```bash
cd /var/www/html/assessexpert/backend
npx ts-node prisma/seed.ts
```

Check `backend/prisma/seed.ts` for the exact email and password it creates. **Change that password immediately after first login** — it's known-in-source.

---

## Cutover from the old server

Once the new box is up and you've smoke-tested (log in as super-admin, run a demo exam), switch DNS:

1. Lower TTL on the A record to 60s a **day before** cutover.
2. When ready, switch the A record to the new IP.
3. Watch: `pm2 logs assessexpert-frontend` on the new box — you'll see traffic land.
4. Keep the old box running for **48 h** as a fallback in case something surprises you.
5. Once you're happy, snapshot the old box and shut it down.

### Optional: bring the old DB over

```bash
# On the OLD box
sudo -u postgres pg_dump -Fc assessexpert > /tmp/assessexpert-old.dump

# scp it to the new box
scp /tmp/assessexpert-old.dump root@NEW_IP:/tmp/

# On the NEW box — pause the backend so nothing writes mid-restore
pm2 stop assessexpert-backend

# Drop + recreate the empty DB, then restore
sudo -u postgres psql -c "DROP DATABASE assessexpert;"
sudo -u postgres psql -c "CREATE DATABASE assessexpert OWNER assessexpert_app;"
sudo -u postgres pg_restore -d assessexpert --no-owner /tmp/assessexpert-old.dump

# Apply any new migrations that landed since the old dump
cd /var/www/html/assessexpert/backend
npx prisma migrate deploy

pm2 start assessexpert-backend
```

---

## Ongoing operations

### Update deploy (after this initial one)

```bash
cd /var/www/html/assessexpert
git pull --recurse-submodules
cd backend
npm install --no-audit --ignore-scripts
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload assessexpert-backend --update-env

cd ../frontend/portal
npm install --no-audit --ignore-scripts
rm -rf .next
npm run build
pm2 reload assessexpert-frontend --update-env

pm2 save
```

Use `reload` (zero-downtime) not `restart`. **Never** run `pm2 update` on the box — it wipes the daemon. The old-server incident was caused by exactly that.

### Health checks

```bash
curl -sSI https://assessexpert.com/api/health
curl -sSI https://assessexpert.com/
pm2 list
```

### Cert renewal

Certbot's systemd timer handles renewal automatically. Verify with:

```bash
systemctl status certbot.timer
certbot renew --dry-run
```

### Backups (recommended, not automated by the script)

Add a cron entry for a nightly `pg_dump`:

```bash
cat > /etc/cron.daily/assessexpert-db-backup <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/var/backups/assessexpert
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d)"
sudo -u postgres pg_dump -Fc assessexpert > "$BACKUP_DIR/db-$STAMP.dump"
# Keep 14 days.
find "$BACKUP_DIR" -name 'db-*.dump' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/assessexpert-db-backup
```

Then off-site them: `rclone`, `restic`, or `aws s3 cp` on a separate weekly cron.

---

## Troubleshooting

**Certbot fails with "DNS problem"** — DNS isn't resolving to this box yet. Wait for propagation (5–60 min after you change the record), then:

```bash
certbot --nginx -d assessexpert.com -d www.assessexpert.com --redirect
```

**Frontend 502/503 from Nginx** — Next.js isn't listening on `:3000`. Check:

```bash
ss -tlnp | grep :3000
pm2 logs assessexpert-frontend --lines 40 --nostream
```

Most common causes: build didn't finish, `.env.production` was edited after the build so `NEXT_PUBLIC_*` values are stale (rebuild), or the process crashed on start (log will say why).

**Backend 500 on `/api/auth/login`** — check backend logs (`pm2 logs assessexpert-backend`). If it says `column "emailVerifiedAt" does not exist` or similar, Prisma migrations didn't apply:

```bash
cd /var/www/html/assessexpert/backend
npx prisma migrate deploy
pm2 reload assessexpert-backend --update-env
```

**`403 Forbidden` on proctor / branding endpoints** — check the role list in the relevant guard. Cross-tenant fixes for PROCTOR / MASTER_PROCTOR are already applied in `main`; if you're on an older branch, `git pull`.

**Recording upload 413 Payload Too Large** — Nginx `client_max_body_size` too small. The vhost sets it to 25M globally; if you legitimately need larger chunks, bump it in `deploy/nginx/assessexpert.conf` and `nginx -s reload`.

---

## Rollback

```bash
cd /var/www/html/assessexpert
git log --oneline -10                   # find the last-known-good sha
git checkout <sha>
cd backend
npm install --no-audit --ignore-scripts && npm run build
pm2 reload assessexpert-backend --update-env
cd ../frontend/portal
npm install --no-audit --ignore-scripts && rm -rf .next && npm run build
pm2 reload assessexpert-frontend --update-env
```

Prisma migrations are not rolled back by git — write a new down-migration if a schema change is the culprit.
