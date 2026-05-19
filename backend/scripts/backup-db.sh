#!/usr/bin/env bash
# Nightly PostgreSQL backup for the AssessExpert database.
#
# Install on the VPS as a daily cron:
#   crontab -e
#   # Run nightly at 02:30 server time
#   30 2 * * * /home/ubuntu/assessexpert/backend/scripts/backup-db.sh \
#     >> /var/log/assessexpert-backup.log 2>&1
#
# Restore from a backup:
#   gunzip -c /var/backups/assessexpert/2026-05-19.sql.gz \
#     | psql "$DATABASE_URL"
#
# Reads DATABASE_URL from backend/.env (the same file the app reads).
# Writes one .sql.gz per day under BACKUP_DIR, keeps RETENTION_DAYS days,
# and deletes older files. Fails loudly — set -euo pipefail means a
# pg_dump failure exits non-zero so cron's MAILTO surfaces the alert.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Source the .env so we pick up DATABASE_URL without exporting it
# globally on the VPS. The .env file is the single source of truth
# for runtime config — keep this script's expectations aligned.
if [[ -f "$BACKEND_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "✗ DATABASE_URL not set — refusing to back up nothing."
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/assessexpert}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
OUT_FILE="$BACKUP_DIR/$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "→ Backing up to $OUT_FILE"
# --no-owner / --no-acl produce a portable dump that can be restored
# into a database owned by a different user — useful when the staging
# box and prod use different role names.
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "$OUT_FILE"

# Verify the file is actually a valid gzip — pg_dump failures upstream
# of gzip would still produce an empty .sql.gz otherwise.
gzip -t "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "✓ Backup written ($SIZE)"

# Prune anything older than RETENTION_DAYS. We use -mtime +N rather
# than tracking filenames so manually-restored test dumps don't break
# the rotation policy.
echo "→ Pruning backups older than $RETENTION_DAYS days from $BACKUP_DIR"
find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "✓ Backup complete."
