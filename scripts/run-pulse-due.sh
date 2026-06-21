#!/usr/bin/env bash
set -euo pipefail

URL="${PULSE_RUNNER_URL:-http://127.0.0.1:3040/chat/api/pulse/run-due}"
AUTH_HEADER=()

if [[ -n "${PULSE_RUNNER_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${PULSE_RUNNER_TOKEN}")
fi

curl -fsS -X POST "${URL}" "${AUTH_HEADER[@]}"
