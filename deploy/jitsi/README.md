# Jitsi self-host — VPS runbook

This replaces the old LiveKit stack. Same VPS, same nginx, free, self-hosted.

## 0. One-time VPS housekeeping (fixes the apt duplicate-sources warning you saw)

```bash
# The warning is harmless but worth clearing so future apt output stays readable
sudo rm -f /etc/apt/sources.list.d/ubuntu-mirrors.list
sudo apt update
```

## 1. DNS

Point `meet.assessexpert.com` (or whichever subdomain you pick) to your VPS public IP.

## 2. Open firewall ports

```bash
sudo ufw allow 443/tcp        # web ui (https — nginx will proxy this)
sudo ufw allow 4443/tcp       # rtc tcp fallback
sudo ufw allow 10000/udp      # rtp media — CRITICAL, must be open externally
sudo ufw reload
```

If you're on a cloud provider (DigitalOcean / AWS / Azure / Hetzner / etc.) also open the same ports on your provider firewall / security group.

## 3. Pull the repo and stand up Jitsi

```bash
cd /var/www/html/assessexpert
git pull origin main

cd deploy/jitsi
cp env.example .env

# Generate the internal Prosody/JVB/Jicofo passwords (idempotent)
chmod +x gen-passwords.sh
./gen-passwords.sh

# Edit .env and set these three things:
#   PUBLIC_URL=https://meet.assessexpert.com
#   DOCKER_HOST_ADDRESS=<your VPS public IP>
#   JWT_APP_SECRET=$(openssl rand -hex 32)
nano .env

# Bring the stack up
docker compose pull
docker compose up -d
docker compose ps     # all four (prosody, jicofo, jvb, web) should be 'running'
docker compose logs --tail=80 prosody jvb jicofo
```

## 4. nginx reverse-proxy for the Jitsi web entry point

Add this to `/etc/nginx/sites-available/assessexpert` (or a new file under `sites-enabled/`):

```nginx
server {
    listen 443 ssl http2;
    server_name meet.assessexpert.com;

    ssl_certificate     /etc/letsencrypt/live/meet.assessexpert.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meet.assessexpert.com/privkey.pem;

    # XMPP websocket — what lib-jitsi-meet uses for signalling
    location ~ ^/xmpp-websocket {
        proxy_pass http://127.0.0.1:8000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 900s;
    }

    # Colibri websocket — what JVB uses for media bridge state
    location ~ ^/colibri-ws/ {
        proxy_pass http://127.0.0.1:8000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 900s;
    }

    # Everything else (config.js, libs, etc.)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Run:
```bash
sudo certbot certonly --nginx -d meet.assessexpert.com   # if you haven't already
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Wire env vars into the AssessExpert backend

Append/update in `/var/www/html/assessexpert/backend/.env`:

```bash
# JITSI_DOMAIN = the XMPP domain (internal). Must equal XMPP_DOMAIN in
# deploy/jitsi/.env — leave as 'meet.jitsi' unless you customised that file.
JITSI_DOMAIN=meet.jitsi
JITSI_APP_ID=assessexpert
JITSI_APP_SECRET=<paste the same value you set as JWT_APP_SECRET in deploy/jitsi/.env>
# JITSI_PUBLIC_URL = the user-facing host. This is what the browser connects to.
JITSI_PUBLIC_URL=https://meet.assessexpert.com
```

> ⚠️ Common trap: `JITSI_DOMAIN` is **not** the public subdomain. It's the
> internal XMPP domain (the value of `XMPP_DOMAIN` in the Jitsi container env).
> The default is `meet.jitsi`. If you put `meet.assessexpert.com` here, prosody
> will reject every JWT because the `sub` claim won't match.

And on the frontend `/var/www/html/assessexpert/frontend/portal/.env.production`:

```bash
NEXT_PUBLIC_JITSI_DOMAIN=meet.assessexpert.com
```

You can remove the old LiveKit vars (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`, `NEXT_PUBLIC_LIVEKIT_URL`) — they're not read any more.

## 6. Rebuild & restart AssessExpert

```bash
cd /var/www/html/assessexpert/backend
npm install                       # picks up removed livekit-server-sdk
npm run build
pm2 restart assessexpert-backend

cd /var/www/html/assessexpert/frontend/portal
npm install                       # installs lib-jitsi-meet, removes livekit-client
npm run build
pm2 restart assessexpert-frontend
```

## 7. Smoke test

1. Open a candidate exam link — verify the camera preview appears in the corner.
2. Open the matching proctor session — verify the candidate's camera shows up in the proctor grid.
3. Click "Start screen share" on the candidate — verify the proctor sees the screen feed.

Tail server logs while doing this:
```bash
docker compose logs -f --tail=20 prosody jvb jicofo
pm2 logs assessexpert-backend --lines 20
```

## 8. Tear down the old LiveKit stack (only when Jitsi is verified working)

```bash
cd /var/www/html/assessexpert/deploy/livekit 2>/dev/null && docker compose down -v
# The directory has been removed from the repo, so this will fail-fast if you've
# already pulled. That's fine — just stop any running container manually:
docker ps -a | grep livekit
docker stop <container-id> && docker rm <container-id>
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Black candidate video, "no media" | UDP 10000 not open | Check `ufw status` AND cloud provider firewall |
| "JsonWebTokenError" in prosody logs | `JITSI_APP_SECRET` differs between backend `.env` and `deploy/jitsi/.env` | Make them identical |
| Browser console: `xmpp-websocket 404` | nginx not proxying ws | Re-check the `location ~ ^/xmpp-websocket` block |
| Camera works but proctor sees nothing | `DOCKER_HOST_ADDRESS` isn't the public IP | `curl ifconfig.me` and put that value in `.env` |
| `gen-passwords.sh: Permission denied` | Script not executable | `chmod +x gen-passwords.sh` |
