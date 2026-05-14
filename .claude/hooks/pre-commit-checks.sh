#!/usr/bin/env bash
# Beacon pre-commit hook.
# Invoked by the .claude/settings.json PreToolUse matcher on Bash commands
# that contain `git commit`. Reads the tool payload on stdin so we can
# inspect the command; lets non-commit Bash calls through immediately.

set -euo pipefail

payload="$(cat)"
cmd="$(printf '%s' "$payload" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("command",""))' 2>/dev/null || true)"

if [[ "$cmd" != *"git commit"* ]]; then
  exit 0
fi

cd "$(dirname "$0")/../.."

echo "▸ pre-commit: pnpm typecheck"
pnpm typecheck >/dev/null

echo "▸ pre-commit: pnpm lint"
pnpm lint --quiet

echo "▸ pre-commit: pnpm test --run"
pnpm test --run >/dev/null

echo "✓ pre-commit checks passed"
