#!/usr/bin/env bash
# provision-new-server.sh
#
# One-shot provisioner for AssessExpert on a fresh Ubuntu 24.04 LTS
# VPS. Idempotent — safe to re-run if something errors mid-way.
#
# WHAT IT INSTALLS
#   - Node.js 22 LTS  (via NodeSource)
#   - PostgreSQL 16   (Ubuntu 24 default)
#   - Redis 7         (rate-limit + cache backing)
#   - Nginx           (reverse proxy for :3000 + :4000)
#   - Certbot         (Let's Encrypt TLS)
#   - PM2             (process manager + systemd unit)
#   - UFW             (firewall — SSH + HTTP + HTTPS only)
#   - Fail2ban        (basic SSH brute-force protection)
#
# WHAT IT DOES
#   1. System hardening: swap, timezone, unattended-upgrades, UFW.
#   2. Installs the stack above.
#   3. Creates the assessexpert DB + role with a locally-generated
#      strong password (nothing leaves the box).
#   4. Clones the repo into /var/www/html/assessexpert.
#   5. Generates real JWT secrets and writes backend/.env locally.
#      Prompts once for SMTP + Cloudflare TURN values (optional; can
#      skip and add later).
#   6. Writes frontend/portal/.env.production.
#   7. Runs Prisma migrate deploy + CMS seed.
#   8. Builds backend + frontend.
#   9. Starts both apps under PM2 via ecosystem.config.js, wires the
#      systemd unit so they auto-start on reboot.
#  10. Installs the Nginx vhost, obtains a Let's Encrypt cert, and
#      turns on HTTPS.
#  11. Smoke-tests the endpoints.
#
# USAGE
#   As root (or with sudo) on a freshly-provisioned Ubuntu 24.04 box:
#
#     wget -O provision.sh https://raw.githubusercontent.com/orbittrainingpoint-a11y/assessexpert/main/deploy/provision-new-server.sh
#     chmod +x provision.sh
#     ./provision.sh
#
#   The script is loud — every step announces itself. If a step
#   fails, fix the underlying issue and re-run: the script's
#   idempotency guards mean already-completed steps are skipped.
#
# BEFORE YOU RUN
#   - Point assessexpert.com and www.assessexpert.com A records at
#     this box's public IP. Nginx + certbot need DNS to resolve here
#     for the TLS step to work. You have 5+ minutes of grace before
#     Nginx setup, but if DNS isn't pointing here yet the certbot
#     step will fail and you'll re-run after DNS propagates.
set -euo pipefail

# ── Configurables ────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-assessexpert.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.assessexpert.com}"
LE_EMAIL="${LE_EMAIL:-enquiry@assessexpert.com}"
REPO_URL="${REPO_URL:-https://github.com/orbittrainingpoint-a11y/assessexpert.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/html/assessexpert}"
DB_NAME="${DB_NAME:-assessexpert}"
DB_USER="${DB_USER:-assessexpert_app}"
NODE_MAJOR="${NODE_MAJOR:-22}"

# ── UI helpers ───────────────────────────────────────────────────────
log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (or with sudo)."
[ -f /etc/os-release ] && . /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] || warn "This script was written for Ubuntu 24.04. Detected: ${PRETTY_NAME:-unknown}. Continuing anyway."

# ── 1. System basics ─────────────────────────────────────────────────
log "1/11  System basics — timezone, upgrades, essentials"
timedatectl set-timezone Asia/Dubai || true

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade
apt-get install -y curl wget git build-essential ca-certificates gnupg \
    ufw fail2ban unattended-upgrades htop jq openssl unzip

# 2 GB swap (only if none exists) — helps the frontend build survive
# on 2GB / 4GB VPS boxes where Turbopack peaks north of 3 GB.
if ! swapon --show | grep -q '/swapfile'; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "2GB swap file created."
else
    ok "Swap already present."
fi
ok "System basics done."

# ── 2. Firewall + fail2ban ───────────────────────────────────────────
log "2/11  Firewall + fail2ban"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
# Raw port numbers so this step doesn't depend on Nginx being
# installed yet (the "Nginx Full" ufw profile ships WITH nginx).
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
ok "Firewall + fail2ban up."

# ── 3. Node.js 22 ────────────────────────────────────────────────────
log "3/11  Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | grep -oE '[0-9]+' | head -1)" -lt "$NODE_MAJOR" ]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
fi
node -v
npm -v
npm install -g pm2
pm2 -v
ok "Node + PM2 installed."

# ── 4. PostgreSQL ────────────────────────────────────────────────────
log "4/11  PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Generate a strong DB password locally. Written only to .env — never
# echoed and never leaves the box.
DB_PASS_FILE="/root/.assessexpert-db-password"
if [ ! -f "$DB_PASS_FILE" ]; then
    openssl rand -base64 32 | tr -d '=/+' | head -c 40 > "$DB_PASS_FILE"
    chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"

# Create role + database if missing. `\gexec` runs the CREATE only
# when the SELECT returns zero rows — so re-runs don't error.
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE ROLE ${DB_USER} LOGIN PASSWORD ''${DB_PASS}'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}')\gexec

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
ok "Postgres DB '${DB_NAME}' and role '${DB_USER}' ready."

# ── 5. Redis ─────────────────────────────────────────────────────────
log "5/11  Redis"
apt-get install -y redis-server
systemctl enable --now redis-server
ok "Redis online (localhost:6379)."

# ── 6. Nginx (Certbot comes after we have code + DNS) ────────────────
log "6/11  Nginx"
apt-get install -y nginx
systemctl enable --now nginx
# ACME challenge webroot for future cert renewals.
mkdir -p /var/www/html/certbot
ok "Nginx running."

# ── 7. Clone repository ──────────────────────────────────────────────
log "7/11  Clone repo → ${APP_DIR}"
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git fetch --all
    git checkout "$REPO_BRANCH"
    git pull --ff-only origin "$REPO_BRANCH"
else
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
ok "Repo at $(git rev-parse --short HEAD) on ${REPO_BRANCH}."

# ── 8. Environment files ─────────────────────────────────────────────
log "8/11  Environment (.env)"

# JWT secrets: two distinct 64-char hex strings. Kept in files so
# re-running the provisioner does NOT rotate them (would log every
# existing user out).
JWT_FILE="/root/.assessexpert-jwt-secret"
JWT_R_FILE="/root/.assessexpert-jwt-refresh-secret"
[ -f "$JWT_FILE" ]   || { openssl rand -hex 32 > "$JWT_FILE";   chmod 600 "$JWT_FILE"; }
[ -f "$JWT_R_FILE" ] || { openssl rand -hex 32 > "$JWT_R_FILE"; chmod 600 "$JWT_R_FILE"; }
JWT="$(cat "$JWT_FILE")"
JWT_R="$(cat "$JWT_R_FILE")"

# Backend .env — created only if it doesn't exist. Preserves any hand
# edits you make on re-runs (SMTP creds, TURN keys).
BACKEND_ENV="$APP_DIR/backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
    cat > "$BACKEND_ENV" <<EOF
# --- Auto-generated by provision-new-server.sh ---
# Rotate JWT secrets by deleting $JWT_FILE and $JWT_R_FILE, then re-running.
# Rotate the DB password by deleting $DB_PASS_FILE (also update DATABASE_URL below).

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

NODE_ENV=production
PORT=4000

JWT_SECRET=${JWT}
JWT_REFRESH_SECRET=${JWT_R}

FRONTEND_URLS=https://${DOMAIN},https://${WWW_DOMAIN}
FRONTEND_URL=https://${DOMAIN}

# Fill these in AFTER provisioning:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@${DOMAIN}

CLOUDFLARE_TURN_KEY_ID=
CLOUDFLARE_TURN_API_TOKEN=

STORAGE_PATH=${APP_DIR}/backend/storage

REDIS_HOST=localhost
REDIS_PORT=6379
# RedisService reads REDIS_URL (host/port above are legacy). Set
# both so either lookup finds a value.
REDIS_URL=redis://localhost:6379

MEDIAPIPE_ENABLED=true
EOF
    chmod 600 "$BACKEND_ENV"
    ok "backend/.env created."
else
    warn "backend/.env already exists — leaving as-is."
fi

# Frontend .env.production — Next.js bakes NEXT_PUBLIC_* into the
# bundle at build time, so this MUST exist before `npm run build`.
FRONTEND_ENV="$APP_DIR/frontend/portal/.env.production"
if [ ! -f "$FRONTEND_ENV" ]; then
    cat > "$FRONTEND_ENV" <<EOF
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
NEXT_PUBLIC_WS_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_NAME=assessexpert
NEXT_PUBLIC_MEDIAPIPE_ENABLED=true
# Optional — coturn / Cloudflare TURN. Leave blank to use browser
# defaults (STUN only). Fill in when you have TURN credentials.
NEXT_PUBLIC_TURN_SERVER=
NEXT_PUBLIC_TURN_SECRET=
EOF
    chmod 600 "$FRONTEND_ENV"
    ok "frontend/portal/.env.production created."
else
    warn "frontend/portal/.env.production already exists — leaving as-is."
fi

# Log + storage dirs
mkdir -p /var/log/assessexpert
mkdir -p "$APP_DIR/backend/storage"
chown -R "$USER:$USER" /var/log/assessexpert "$APP_DIR/backend/storage" || true

# ── 9. Install + build ───────────────────────────────────────────────
log "9/11  Backend install + Prisma + build"
cd "$APP_DIR/backend"
# NOTE: allow lifecycle scripts here — bcrypt's postinstall compiles
# a native binding (bcrypt_lib.node) that fails at runtime if you
# skip it with --ignore-scripts. Prisma also uses postinstall to
# generate the client for the installed platform.
npm install --no-audit
npx prisma generate
npx prisma migrate deploy
# Seed the CMS pages (home/about/services/manpower/contact/blog) so
# the marketing site is not empty on first hit.
if [ -f prisma/seed-cms.ts ]; then
    npx ts-node prisma/seed-cms.ts || warn "CMS seed failed — you can re-run manually later."
fi
npm run build
ok "Backend built."

log "9/11  Frontend install + build (this takes 15–25 min on modest hardware)"
cd "$APP_DIR/frontend/portal"
npm install --no-audit --ignore-scripts
rm -rf .next
NODE_OPTIONS="--max-old-space-size=4096" npm run build
ok "Frontend built."

# ── 10. PM2 processes + systemd ──────────────────────────────────────
log "10/11  PM2 + systemd"
cd "$APP_DIR"
# Reload is a no-op if not running yet; start otherwise. This keeps
# re-runs safe.
if pm2 describe assessexpert-backend >/dev/null 2>&1 \
   && pm2 describe assessexpert-frontend >/dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start ecosystem.config.js
fi
pm2 save
# Wire PM2 to systemd so both apps come back after a reboot. This
# emits the exact command you need to run (idempotent — you can run
# it a second time safely).
pm2 startup systemd -u root --hp /root >/dev/null || true
ok "PM2 apps running:"
pm2 list

# ── 11. Nginx vhost + Let's Encrypt ──────────────────────────────────
log "11/11  Nginx vhost + Let's Encrypt"
install -m 0644 "$APP_DIR/deploy/nginx/assessexpert.conf" \
    /etc/nginx/sites-available/assessexpert.conf
ln -sf /etc/nginx/sites-available/assessexpert.conf \
    /etc/nginx/sites-enabled/assessexpert.conf
# Get rid of the "Welcome to nginx" default that shadows everything.
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
ok "Nginx serving HTTP for ${DOMAIN}."

# Certbot — needs DNS pointing at this box. If it fails, the rest of
# the stack is still fine; you can re-run just this step later.
apt-get install -y certbot python3-certbot-nginx
if certbot --nginx --non-interactive --agree-tos \
    --email "$LE_EMAIL" \
    -d "$DOMAIN" -d "$WWW_DOMAIN" \
    --redirect --keep-until-expiring; then
    ok "HTTPS is on."
else
    warn "Certbot failed. Common cause: DNS not yet pointing at this box."
    warn "Fix DNS, then re-run:"
    warn "    certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} --redirect"
fi

# ── Smoke check ──────────────────────────────────────────────────────
log "Smoke check"
sleep 3
echo
echo "  Backend health   : $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/api/health || echo '???')"
echo "  Frontend root    : $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo '???')"
echo "  Public HTTPS root: $(curl -sS -o /dev/null -w '%{http_code}' https://${DOMAIN}/ || echo '???')"
echo "  Public /api ping : $(curl -sS -o /dev/null -w '%{http_code}' https://${DOMAIN}/api/health || echo '???')"
echo

log "Done."
cat <<EOF

Next steps:
  1. Set SMTP creds in ${BACKEND_ENV}, then:
       pm2 reload assessexpert-backend --update-env
  2. (Optional) Add Cloudflare TURN keys in the same file.
  3. Log in as super-admin — check backend/prisma/seed.ts for the
     bootstrap account credentials, or seed one now with:
       cd ${APP_DIR}/backend && npx ts-node prisma/seed.ts
  4. Rotate any credentials that were leaked in previous chat
     sessions. Secrets stored under /root/.assessexpert-*.

Everything above lives on the box now; no secrets pass through chat.
EOF
