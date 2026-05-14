#!/usr/bin/env bash
# Beacon post-edit hook.
# Reads the Edit/Write tool result from stdin and runs Prettier on the file
# that was just touched. Soft-fails so a Prettier error never blocks a write.

set -uo pipefail

payload="$(cat)"
path="$(printf '%s' "$payload" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or (d.get("tool_input") or {}).get("path") or "")' 2>/dev/null || true)"

if [[ -z "$path" ]]; then exit 0; fi
case "$path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css) ;;
  *) exit 0 ;;
esac

cd "$(dirname "$0")/../.."

if [[ -x "node_modules/.bin/prettier" ]]; then
  node_modules/.bin/prettier --write --log-level=warn "$path" 2>/dev/null || true
fi
