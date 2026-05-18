#!/usr/bin/env bash
# Production deploy for the AssessExpert backend.
#
# What it does, in order:
#   1. Pulls the latest dependencies (postinstall hook regenerates the
#      Prisma client automatically).
#   2. Pre-flight checks the migration state and reports drift instead of
#      blindly applying. The deploy ABORTS on drift so we never run a
#      migration on top of a divergent schema.
#   3. Applies pending migrations.
#   4. Builds the NestJS dist.
#   5. Reloads the PM2 process.
#
# Run from the backend/ directory:
#   ./scripts/deploy.sh
#
# Or via npm:
#   npm run deploy
#
# Fails fast — set -euo pipefail so we never half-deploy.
set -euo pipefail

echo "→ Installing dependencies (postinstall regenerates the Prisma client)..."
npm install

echo
echo "→ Checking migration state for drift..."
# `prisma migrate status` exits non-zero when there's drift, schema
# mismatch, or unapplied migrations. We catch the failure and inspect
# the output instead of letting set -e kill us.
STATUS_OUTPUT="$(npx prisma migrate status 2>&1 || true)"
echo "$STATUS_OUTPUT"

if echo "$STATUS_OUTPUT" | grep -qiE "drift detected|database schema is not in sync"; then
  echo
  echo "⛔ DRIFT DETECTED. Aborting deploy."
  echo "   Resolve the drift in psql, then re-run this script."
  echo "   (Common fix: run the failing migration manually, then"
  echo "    'npx prisma migrate resolve --applied <migration_name>'.)"
  exit 2
fi

echo
echo "→ Applying any pending migrations..."
npx prisma migrate deploy

echo
echo "→ Building backend..."
npm run build

echo
echo "→ Reloading PM2 backend process..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload assessexpert-backend --update-env || pm2 restart assessexpert-backend
else
  echo "  (pm2 not in PATH — skipping reload. Restart manually.)"
fi

echo
echo "✓ Deploy complete."
