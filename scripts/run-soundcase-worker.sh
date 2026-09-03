#!/usr/bin/env bash
set -euo pipefail

soundcase_worker_url="${SOUNDCASE_WORKER_URL:-http://127.0.0.1:3040/chat/api/soundcase/worker/run-next}"
: "${SOUNDCASE_WORKER_TOKEN:?SOUNDCASE_WORKER_TOKEN ausente}"

while true; do
  soundcase_http_status="$(
    printf 'Authorization: Bearer %s\n' "${SOUNDCASE_WORKER_TOKEN}" |
      /usr/bin/curl --silent --show-error --request POST --header @- \
        --connect-timeout 10 --max-time 10800 \
        --output /dev/null --write-out '%{http_code}' "${soundcase_worker_url}"
  )"
  case "${soundcase_http_status}" in
    204) exit 0 ;;
    200) ;;
    *) printf 'SoundCase worker HTTP %s\n' "${soundcase_http_status}" >&2; exit 1 ;;
  esac
done
