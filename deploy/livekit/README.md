# Self-hosted LiveKit for AssessExpert

Replaces the previous unreliable P2P WebRTC stack with a proper SFU.

## One-time server setup

```bash
# 1. SSH to your live server
ssh root@your-server

# 2. Make sure docker + docker-compose are installed
docker --version          # 24+ ok
docker compose version    # v2+ ok

# 3. Pull latest code so this directory exists
cd /var/www/html/assessexpert
git pull origin main

# 4. Create your LiveKit config from the example
cd deploy/livekit
cp livekit.yaml.example livekit.yaml

# 5. Generate a real API key + secret and put them in livekit.yaml
#    (or invent random ones, just keep them > 32 chars)
python3 -c "import secrets; print('APIkey:', 'API' + secrets.token_urlsafe(12))"
python3 -c "import secrets; print('Secret:', secrets.token_urlsafe(48))"

# 6. Edit livekit.yaml — replace the `keys:` section AND `turn.domain`
nano livekit.yaml

# 7. Open the required firewall ports
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
sudo ufw allow 3478/udp
sudo ufw allow 50000:60000/udp
sudo ufw reload

# 8. Start LiveKit
docker compose up -d
docker compose logs -f livekit   # watch for "starting LiveKit server" + no errors

# 9. Point a subdomain at the server, e.g. livekit.yourdomain.com → A record → server IP
#    Then set up nginx + TLS:
sudo cp nginx-livekit.conf.example /etc/nginx/sites-available/livekit
sudo nano /etc/nginx/sites-available/livekit    # replace livekit.yourdomain.com with real domain
sudo ln -s /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d livekit.yourdomain.com

# 10. Configure the AssessExpert backend
cd /var/www/html/assessexpert/backend
cat >> .env <<'EOF'
LIVEKIT_API_KEY=<the key you put in livekit.yaml>
LIVEKIT_API_SECRET=<the secret you put in livekit.yaml>
LIVEKIT_WS_URL=wss://livekit.yourdomain.com
EOF

# 11. Configure the frontend
cd /var/www/html/assessexpert/frontend/portal
cat >> .env.production <<'EOF'
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
EOF

# 12. Install new node deps + rebuild
cd /var/www/html/assessexpert/backend && npm install && npm run build
cd /var/www/html/assessexpert/frontend/portal && npm install && npm run build

# 13. Restart your services
pm2 restart assessexpert-backend
pm2 restart assessexpert-frontend
```

## Verifying it works

```bash
# Should return "OK"
curl https://livekit.yourdomain.com/

# Backend should mint a token without erroring
curl http://localhost:4000/livekit/candidate-token?magicToken=<some-real-magic-token>
```

Then open a candidate exam link in one browser and a proctor session in another — within 2 seconds you should see each other's video and hear each other's mic. If not, check:
- `docker compose logs livekit` for errors
- Browser console for `WebSocket connection failed` (means nginx/TLS misconfigured)
- Browser console for `ICE failed` (means UDP 50000-60000 not open in firewall)

## Why this fixes the issues

| Old problem                  | New behaviour                                                         |
|------------------------------|-----------------------------------------------------------------------|
| Free TURN is unreliable      | LiveKit ships its own TURN built-in                                   |
| N² P2P connections           | One connection per peer to the SFU — scales linearly                  |
| ICE timing race conditions   | LiveKit handles all signalling + reconnection automatically           |
| No screen-share confirmation | LiveKit publishes screen as a separate track — proctor sees it appear |
| MediaPipe wasn't running     | New client-side hook reads MediaPipe locally and emits ai.* events    |
