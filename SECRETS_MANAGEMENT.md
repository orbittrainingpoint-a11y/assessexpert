# Secrets Management Runbook

**Owner:** whoever's holding pager
**Location of live secrets:** `/var/www/html/assessexpert/backend/.env` on the production VPS. Not in git.
**Golden rule:** never paste `.env` contents into chat, screenshots, git commits, or Slack. If you must share for debugging, redact the value.

---

## 1. What secrets exist and what they gate

| Env var | What it gates | Rotation impact |
|---|---|---|
| `DATABASE_URL` password | Prisma connection to Postgres | Backend can't query DB → 500s until restart with fresh env |
| `JWT_SECRET` | Access-token signing | **Every logged-in user is force-logged-out** on restart |
| `JWT_REFRESH_SECRET` | Refresh-token signing | Same — everyone re-logs in |
| `SESSION_SECRET` | Express session (currently minimal use) | Any active session-based flows drop |
| `SMTP_PASS` | Outbound email via Gmail app password | No emails sent until restart |
| `GEMINI_API_KEY` | AI report generation via Google Gemini | AI report step fails; base report still generates |
| `JITSI_APP_SECRET` | Jitsi meeting token signing | Live proctor video sessions drop mid-session |
| `CLOUDFLARE_TURN_API_TOKEN` | Ephemeral TURN credentials for WebRTC | New sessions can't traverse restrictive firewalls |
| `TWILIO_*` | Currently placeholder | No impact — unused |
| `AWS_*` | Currently placeholder | No impact — unused |

---

## 2. When to rotate

Rotate immediately when:
- The secret has been leaked (chat, git, screenshot, log, backup that escaped)
- A team member with knowledge of the value leaves
- A dependency shipped a CVE that could exfiltrate the value
- Compliance calendar says so (annual for most, quarterly for JWT is sensible)

Rotate on a schedule anyway — quarterly for high-blast-radius (JWT / DB), semi-annually for the rest.

---

## 3. Rotation order (do them in this sequence — minimises user impact)

Do all in one maintenance window (~15 minutes). Announce beforehand if any user is actively signed in — JWT rotation logs them out.

### 3.1 Prerequisites — one-time

```bash
# Get on the VPS as root
ssh root@mail
cd /var/www/html/assessexpert/backend

# Take a snapshot of the current .env first (so you can compare / restore)
cp .env .env.backup-$(date +%F-%H%M)
```

### 3.2 Non-user-facing rotations (do first — no impact)

**Database password:**
```bash
NEW_DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql -c "ALTER USER assessexpert_app WITH PASSWORD '$NEW_DB_PASS';"

# Save the new value in your password manager BEFORE editing .env
echo "$NEW_DB_PASS"

# Update .env (this sed replaces the password portion between :  and @localhost)
sed -i "s|:[^:@]*@localhost|:$NEW_DB_PASS@localhost|" .env

# Verify
grep DATABASE_URL .env
PGPASSWORD="$NEW_DB_PASS" psql -U assessexpert_app -h localhost -d assessexpert -c 'SELECT 1;'
```

**SESSION_SECRET:**
```bash
NEW_SESSION=$(openssl rand -base64 32)
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$NEW_SESSION|" .env
grep SESSION_SECRET .env  # confirm
```

### 3.3 High-impact rotations (users log out)

**JWT_SECRET + JWT_REFRESH_SECRET (rotate together — they interact):**
```bash
NEW_JWT=$(openssl rand -base64 48)
NEW_JWT_REFRESH=$(openssl rand -base64 48)

sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT|" .env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$NEW_JWT_REFRESH|" .env

grep -E "^JWT_SECRET|^JWT_REFRESH_SECRET" .env  # confirm both changed
```

### 3.4 External-console rotations (need you to log into another service)

**SMTP_PASS (Gmail App Password):**
- Log into https://myaccount.google.com/security → 2-Step Verification → App passwords
- Delete the current app password for AssessExpert
- Generate a new one, name "AssessExpert VPS 2026-Q3"
- Copy the 16-char password (spaces removed): `sed -i "s|^SMTP_PASS=.*|SMTP_PASS=<new-value>|" .env`

**GEMINI_API_KEY:**
- Log into https://aistudio.google.com/apikey
- Delete the current key
- Create new key restricted to your GCP project
- Set daily quota (currently unset — this is a P1 gap; ~$50/day is a sensible cap for now)
- `sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=<new-value>|" .env`

**CLOUDFLARE_TURN_API_TOKEN:**
- Cloudflare dash → https://dash.cloudflare.com → Calls (Realtime) → API tokens
- Revoke the current token
- Create a new one with only the `Calls:Edit` permission
- `sed -i "s|^CLOUDFLARE_TURN_API_TOKEN=.*|CLOUDFLARE_TURN_API_TOKEN=<new-value>|" .env`

**JITSI_APP_SECRET:**
- If self-hosted Jitsi: regenerate `openssl rand -hex 32` and update both your Jitsi Prosody config AND the AssessExpert .env — they must match
- If using Jitsi-as-a-service: rotate via their dashboard
- `sed -i "s|^JITSI_APP_SECRET=.*|JITSI_APP_SECRET=<new-value>|" .env`

### 3.5 Apply

```bash
# Rebuild is NOT needed for env changes — pm2 restart with --update-env is enough
pm2 restart assessexpert-backend --update-env

# Watch for successful boot
pm2 logs assessexpert-backend --lines 40 --nostream

# Sanity check
curl -sI http://localhost:4000/api/health | head -1
# Expect: HTTP/1.1 200 OK
```

### 3.6 Post-rotation checklist

- [ ] Delete the `.env.backup-*` file once you've verified everything works (24-48h later). Contains stale secrets.
- [ ] Confirm login still works from the browser
- [ ] Confirm a test candidate email actually sends (create a test candidate → schedule → check inbox)
- [ ] Delete the leaked-in-chat version from your password manager if it was stored anywhere
- [ ] Update your `SECRET_ROTATION_LOG.md` (create if it doesn't exist — see §5)

---

## 4. When something goes wrong

### 4.1 "I rotated JWT and now the site is broken"

You didn't restart pm2 with `--update-env`. Do it now:
```bash
pm2 restart assessexpert-backend --update-env
```

### 4.2 "I rotated DB password and backend won't start"

- Grep the log for `P1000` — that's Prisma auth failure
- Double-check `.env` DATABASE_URL matches what you set on the DB
- Test with `PGPASSWORD="..." psql -U assessexpert_app -h localhost -d assessexpert -c 'SELECT 1;'`
- If it works but the app still can't connect, `pm2 restart --update-env` (env cache)

### 4.3 "I rotated something but need to roll back"

Restore from the timestamped backup:
```bash
cp .env.backup-2026-07-23-1445 .env
pm2 restart assessexpert-backend --update-env
```
If the backup was already deleted, restore from git for scaffolding (the actual secret values aren't in git — you'll have to regenerate).

---

## 5. Suggested rotation log format

Keep a plaintext audit trail at `/var/www/html/assessexpert/SECRET_ROTATION_LOG.md` (or wherever). One line per rotation:

```
2026-07-21  DB_password         Rotated because .env leaked to chat.  Verified: SELECT 1 OK.  New password saved in 1Password entry "AssessExpert-DB-Prod".
2026-07-23  JWT + REFRESH       Scheduled quarterly rotation.  Users logged out.  Verified login flow.
2026-07-23  SESSION_SECRET      Was placeholder string until now.  Verified /api/health 200.
```

Don't put the actual secret values in the log. Just what happened, when, why, and where the new value is stored.

---

## 6. Never do

- Never paste `.env` contents into chat, screenshots, tickets, Slack, email, or commit them
- Never re-use rotated secrets — treat old values as public forever
- Never share via unencrypted email or SMS — use a password manager with sharing (1Password, Bitwarden) or a secure ephemeral share (age-encrypted file, `wormhole`, etc.)
- Never rotate JWT during business hours without an outage window — every user is force-logged-out
- Never keep the `.env.backup-*` files around indefinitely — they're stale secrets waiting to leak
- Never commit `.env.example` with real values — only placeholders
