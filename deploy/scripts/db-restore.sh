#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <backup-file.sql>"
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
INPUT_FILE="$1"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Input file not found: $INPUT_FILE"
  exit 1
fi

docker compose \
  --env-file "$PROJECT_ROOT/deploy/.env" \
  -f "$PROJECT_ROOT/docker-compose.yml" \
  exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$INPUT_FILE"

echo "Restore completed from: $INPUT_FILE"
