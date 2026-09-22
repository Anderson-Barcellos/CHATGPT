#!/usr/bin/env bash

# Sobe um runtime de QA sem tocar no checkout ou na porta de produção.
set -euo pipefail

script_source="${BASH_SOURCE[0]}"
while [[ -h "$script_source" ]]; do
  script_directory="$(cd -P "$(dirname "$script_source")" && pwd)"
  script_source="$(readlink "$script_source")"
  [[ "$script_source" != /* ]] && script_source="$script_directory/$script_source"
done
script_directory="$(cd -P "$(dirname "$script_source")" && pwd)"
project_directory="$(cd "$script_directory/.." && pwd -P)"

# shellcheck source=lib/runtime-safety.sh
source "$script_directory/lib/runtime-safety.sh"

port=""
while (($# > 0)); do
  case "$1" in
    --port)
      (($# >= 2)) || runtime_safety_die "--port exige um valor."
      port="$2"
      shift 2
      ;;
    *) runtime_safety_die "Argumento desconhecido: $1" ;;
  esac
done

[[ "$port" =~ ^[0-9]+$ ]] || runtime_safety_die "Informe uma porta válida com --port."
port=$((10#$port))
((port >= 1 && port <= 65535)) || runtime_safety_die "Informe uma porta válida com --port."

# Confirma o isolamento antes de consultar a porta, criar o build ou iniciar Node.
runtime_safety_require_isolated_checkout "$project_directory"

ss_bin="${GAUCHO_SS_BIN:-ss}"
npm_bin="${GAUCHO_NPM_BIN:-npm}"

require_free_port() {
  local listeners

  if ! listeners="$("$ss_bin" -H -ltn "sport = :$port")"; then
    runtime_safety_die "Não foi possível verificar a porta loopback $port."
  fi

  if [[ -n "$listeners" ]]; then
    runtime_safety_die "A porta loopback $port já está em uso; nenhum processo foi sinalizado."
  fi
}

require_free_port
cd "$project_directory"

printf '→ Build isolado em http://127.0.0.1:%s/chat\n' "$port"
GAUCHO_ISOLATED_RUNTIME=true \
  NEXT_PUBLIC_BASE_PATH=/chat \
  NEXT_PUBLIC_APP_URL="http://127.0.0.1:$port/chat" \
  PORT="$port" \
  NODE_ENV=production \
  "$npm_bin" run build

# O build pode durar bastante; verifica novamente antes de reservar a porta.
require_free_port
printf '→ Iniciando QA isolado em http://127.0.0.1:%s/chat\n' "$port"
exec env \
  GAUCHO_ISOLATED_RUNTIME=true \
  NEXT_PUBLIC_BASE_PATH=/chat \
  NEXT_PUBLIC_APP_URL="http://127.0.0.1:$port/chat" \
  PORT="$port" \
  NODE_ENV=production \
  "$npm_bin" start -- --hostname 127.0.0.1 --port "$port"
