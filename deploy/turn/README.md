# coturn — TURN/STUN server for AssessExpert WebRTC

The WebRTC stack between candidate and proctor uses direct STUN by
default. For candidates behind strict corporate firewalls (UDP blocked
entirely, or only TCP 443 allowed) you'll hit "WebRTC pending" forever.
A TURN server relays the media when direct ICE fails.

Recommended: run coturn on the **same VPS** as the backend, or on a
separate small VPS in the same region. This guide assumes Ubuntu 22.04.

## 1. Install

```bash
sudo apt-get update
sudo apt-get install -y coturn
```

Enable the service to start on boot:

```bash
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

## 2. Configure

Edit `/etc/turnserver.conf`. Replace the contents with:

```conf
# Listening config — bind to all interfaces; the firewall handles exposure.
listening-port=3478
tls-listening-port=5349

# Realm = your domain (any string; clients must use the same).
realm=assessexpert.com

# Fingerprinting + long-term credentials (required by browsers).
fingerprint
lt-cred-mech

# Static user. Username "assessexpert" matches the frontend useJitsi.ts.
# Change the password to a strong random value — also set it in the
# NEXT_PUBLIC_TURN_SECRET env on the frontend so the two match.
user=assessexpert:CHANGE-THIS-TO-A-STRONG-SECRET

# Disable insecure features.
no-cli
no-loopback-peers
no-multicast-peers

# Public/external IP — REQUIRED if coturn is behind NAT (most VPS hosts
# expose a public IP directly; set this to that IP).
external-ip=88.222.215.20

# Media relay port range. 49152-65535 is the default; narrow to 50000-50100
# if you want to firewall fewer UDP ports (still enough for ~50 concurrent
# call legs).
min-port=49152
max-port=65535

# (Optional) TLS for turns:// — point at Let's Encrypt certs for your TURN
# hostname. Comment out if you're not using turns:.
# cert=/etc/letsencrypt/live/turn.assessexpert.com/fullchain.pem
# pkey=/etc/letsencrypt/live/turn.assessexpert.com/privkey.pem

# Log to syslog at warning level; bump to "info" for debugging.
syslog
no-stdout-log
log-level=warning

# Refuse to relay traffic that originates from RFC1918 ranges back into
# the public internet (anti-amplification hardening).
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
allowed-peer-ip=0.0.0.0-255.255.255.255
```

## 3. Open the firewall

UDP 3478 is the main port. TCP 3478 + UDP 49152-65535 are the relay range.
TCP 5349 is `turns:` (TLS).

```bash
sudo ufw allow 3478/udp comment 'TURN'
sudo ufw allow 3478/tcp comment 'TURN (TCP fallback)'
sudo ufw allow 49152:65535/udp comment 'TURN relay range'
sudo ufw allow 5349/tcp comment 'TURNS (TLS)'   # optional
sudo ufw reload
```

If your VPS provider has its own firewall (Hetzner, DigitalOcean, Lightsail),
open the same ports there too — `ufw` alone is not enough.

## 4. Start

```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
sudo systemctl status coturn
```

Expected: `Active: active (running)` and a line about "RTC TURN/STUN server".

## 5. Verify it works

From your laptop:

```bash
# UDP path
sudo apt install -y stun-client   # or: brew install stunclient
stun 88.222.215.20:3478
# Expected: "Primary: Open / TCP / UDP" or similar — non-empty mapped address.
```

In a browser, https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- Add server: `turn:88.222.215.20:3478?transport=udp`
- Username: `assessexpert`
- Credential: (the password from your turnserver.conf)
- Click "Gather candidates". You should see `typ relay` rows — that
  proves coturn is correctly relaying through your server.

If you see only `typ host` and `typ srflx` rows, the TURN config is
broken or the firewall is blocking.

## 6. Wire the frontend

Set this in `frontend/portal/.env.production`:

```
NEXT_PUBLIC_TURN_SECRET=the-same-strong-password-as-turnserver.conf
NEXT_PUBLIC_WS_URL=https://api.assessexpert.com
```

The TURN server hostname is derived from `NEXT_PUBLIC_WS_URL` in
`frontend/portal/lib/useJitsi.ts` — strip protocol/port, then port 3478/5349
are appended. If your TURN server lives at a DIFFERENT hostname than your
backend, edit that block in `useJitsi.ts` (line ~22) and hard-code the
TURN host.

Rebuild + restart the frontend:

```bash
cd frontend/portal
npm run build
pm2 restart all
```

## 7. Monitor

```bash
sudo journalctl -u coturn -f
```

You'll see "allocation" lines when a candidate's WebRTC connection
falls back through coturn. If you never see allocations, candidates
are getting direct P2P and TURN is just sitting idle — that's fine,
TURN is a safety net.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `typ relay` never appears in trickle-ICE | `external-ip` is wrong, or firewall blocks UDP 3478 |
| Proctor sees candidate behind corp firewall as "WebRTC pending" | TURN credential mismatch — check `NEXT_PUBLIC_TURN_SECRET` |
| Coturn refuses to start | Permissions on cert files (`chmod 644`), or port already in use |
| Excessive bandwidth on TURN host | Limit `max-bps` per-connection in `/etc/turnserver.conf` (e.g. `max-bps=1000000` for 1 Mbps cap) |

## Cost note

For ~20 concurrent exams of 90 min each, TURN bandwidth peaks around
~200 GB/day if EVERY candidate falls back through TURN. In practice
most do direct P2P, so real-world TURN traffic is closer to 5-10% of
that. Pick a VPS with at least 2 TB/month bandwidth if you expect to
serve relay traffic.
