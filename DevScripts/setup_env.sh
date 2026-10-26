#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--install" ]]; then shift; fi
exec node "$ROOT_DIR/DevScripts/electron-cli.mjs" setup "$@"
