#!/bin/bash
# One-time script — generates random passwords for the internal Jitsi XMPP users
# and writes them into .env. Run AFTER copying env.example to .env.

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy env.example to .env first."
  exit 1
fi

# Skip if already filled in
if grep -q "^JICOFO_COMPONENT_SECRET=.\+" .env 2>/dev/null; then
  if grep -q "^JICOFO_AUTH_PASSWORD=.\+" .env 2>/dev/null && \
     grep -q "^JVB_AUTH_PASSWORD=.\+" .env 2>/dev/null; then
    echo "Passwords already set in .env — nothing to do."
    exit 0
  fi
fi

JICOFO_COMPONENT_SECRET=$(openssl rand -hex 16)
JICOFO_AUTH_PASSWORD=$(openssl rand -hex 16)
JVB_AUTH_PASSWORD=$(openssl rand -hex 16)

# Replace empty values
sed -i "s/^JICOFO_COMPONENT_SECRET=.*/JICOFO_COMPONENT_SECRET=${JICOFO_COMPONENT_SECRET}/" .env
sed -i "s/^JICOFO_AUTH_PASSWORD=.*/JICOFO_AUTH_PASSWORD=${JICOFO_AUTH_PASSWORD}/" .env
sed -i "s/^JVB_AUTH_PASSWORD=.*/JVB_AUTH_PASSWORD=${JVB_AUTH_PASSWORD}/" .env

echo "Generated internal passwords. Now edit .env and set:"
echo "  - DOCKER_HOST_ADDRESS to your VPS public IP"
echo "  - PUBLIC_URL to your jitsi subdomain"
echo "  - JWT_APP_SECRET (use: openssl rand -hex 32)"
echo "Then: docker compose up -d"
