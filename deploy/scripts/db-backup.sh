#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/deploy/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${1:-$BACKUP_DIR/db-backup-$TIMESTAMP.sql}"

mkdir -p "$BACKUP_DIR"

docker compose \
  --env-file "$PROJECT_ROOT/deploy/.env" \
  -f "$PROJECT_ROOT/docker-compose.yml" \
  exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$OUTPUT_FILE"

echo "Backup created: $OUTPUT_FILE"
