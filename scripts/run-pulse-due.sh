#!/usr/bin/env bash
set -euo pipefail

URL="${PULSE_RUNNER_URL:-http://127.0.0.1:3040/chat/api/pulse/run-due}"
curl_bin="${GAUCHO_CURL_BIN:-curl}"
token="${PULSE_RUNNER_TOKEN:-}"

[[ -n "${token//[[:space:]]/}" ]] || {
  printf 'PULSE_RUNNER_TOKEN ausente.\n' >&2
  exit 1
}

printf 'Authorization: Bearer %s\n' "$token" |
  "$curl_bin" -fsS -X POST -H @- "${URL}"
printf '\n'
