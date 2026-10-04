#!/usr/bin/env bash
set -euo pipefail

URL="${DISCOVER_RUNNER_URL:-http://127.0.0.1:3040/chat/api/discover/run-due}"
token="${DISCOVER_RUNNER_TOKEN:-}"
[[ -n "${token//[[:space:]]/}" ]] || { printf 'DISCOVER_RUNNER_TOKEN ausente.\n' >&2; exit 1; }

printf 'Authorization: Bearer %s\n' "$token" |
  "${GAUCHO_CURL_BIN:-curl}" -fsS -X POST -H @- "$URL"
printf '\n'
