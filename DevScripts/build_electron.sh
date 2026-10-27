#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js 22 x64 (including npm), then reopen your terminal.' >&2
  exit 1
fi
exec node "$SCRIPT_DIR/electron-cli.mjs" build "$@"
