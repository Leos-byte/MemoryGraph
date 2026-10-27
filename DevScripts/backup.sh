#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/Backup/$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

tar \
  --exclude='./.git' \
  --exclude='./.aws' \
  --exclude='./.codex' \
  --exclude='./.agents' \
  --exclude='.env*' \
  --exclude='*.sqlite*' \
  --exclude='*.db*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='auth.json' \
  --exclude='./Source/build' \
  --exclude='./Source/node_modules' \
  --exclude='./Source/dist-main' \
  --exclude='./Source/dist-renderer' \
  --exclude='./Source/dist-release' \
  --exclude='./Source/test-results' \
  --exclude='./Source/playwright-report' \
  --exclude='./Backup' \
  --exclude='./Releases' \
  -C "$ROOT_DIR" \
  -czf "$BACKUP_DIR/source.tar.gz" \
  .

mkdir -p "$BACKUP_DIR/Releases"
find "$ROOT_DIR/Releases" -maxdepth 1 -type f \( -name '*.tar.gz' -o -name '*.run' -o -name '*.AppImage' -o -name '*.exe' -o -name '*.zip' \) -exec cp {} "$BACKUP_DIR/Releases/" \;
if [[ -f "$ROOT_DIR/Source/update-public-key.pem" ]]; then
  cp "$ROOT_DIR/Source/update-public-key.pem" "$BACKUP_DIR/update-public-key.pem"
fi

echo "Backup written to $BACKUP_DIR"

