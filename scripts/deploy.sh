#!/usr/bin/env bash

# Publica o Gaucho Chat no checkout vivo do chatgpt.service.
#
#   scripts/deploy.sh                 gates + build numa cópia isolada, depois instala
#   scripts/deploy.sh --from <dir>    instala a .next já validada de <dir>
#
# A build nova entra com backup da anterior e os assets antigos retidos (abas
# abertas continuam carregando chunks velhos). Se o health local falhar depois
# do restart, a build anterior volta sozinha. O diretório da build precisa
# continuar existindo: a .next instalada referencia esse caminho.
set -euo pipefail

script_source="${BASH_SOURCE[0]}"
while [[ -h "$script_source" ]]; do
  script_directory="$(cd -P "$(dirname "$script_source")" && pwd)"
  script_source="$(readlink "$script_source")"
  [[ "$script_source" != /* ]] && script_source="$script_directory/$script_source"
done
script_directory="$(cd -P "$(dirname "$script_source")" && pwd)"

# shellcheck source=lib/runtime-safety.sh
source "$script_directory/lib/runtime-safety.sh"

from_directory=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      [[ $# -ge 2 ]] || runtime_safety_die "--from exige um diretório."
      from_directory="$2"
      shift 2
      ;;
    *) runtime_safety_die "Argumento desconhecido: $1" ;;
  esac
done

systemctl_bin="${GAUCHO_SYSTEMCTL_BIN:-systemctl}"
curl_bin="${GAUCHO_CURL_BIN:-curl}"
npm_bin="${GAUCHO_NPM_BIN:-npm}"
service_name="${GAUCHO_RUNTIME_SERVICE:-chatgpt.service}"
base_path="${GAUCHO_DEPLOY_BASE_PATH:-/chat}"
local_health_url="${GAUCHO_HEALTH_LOCAL_URL:-http://127.0.0.1:3040/chat/api/health}"
public_health_url="${GAUCHO_HEALTH_PUBLIC_URL:-https://ultrassom.ai/chat/api/health}"
health_attempts="${GAUCHO_HEALTH_ATTEMPTS:-30}"
health_interval="${GAUCHO_HEALTH_INTERVAL:-2}"
deploy_root="${GAUCHO_DEPLOY_ROOT:-/root/.cache/gaucho-deploy}"

step() {
  printf '→ %s\n' "$*"
}

build_id_of() {
  local next_directory="$1"
  [[ -f "$next_directory/BUILD_ID" ]] && cat "$next_directory/BUILD_ID" || printf '(sem build)'
}

# Espera o endpoint responder 200; devolve 1 se esgotar as tentativas.
wait_for_health() {
  local url="$1"
  local attempt code
  for ((attempt = 1; attempt <= health_attempts; attempt++)); do
    code="$("$curl_bin" -s -o /dev/null -w '%{http_code}' "$url" || true)"
    [[ "$code" == "200" ]] && return 0
    sleep "$health_interval"
  done
  printf 'último status de %s: %s\n' "$url" "${code:-sem resposta}" >&2
  return 1
}

live_directory="$(runtime_safety_live_working_directory)"
run_directory="$deploy_root/$(date -u +%Y%m%dT%H%M%SZ)"

if [[ -n "$from_directory" ]]; then
  build_directory="$(runtime_safety_canonical_directory "$from_directory")"
  [[ "$build_directory" != "$live_directory" ]] \
    || runtime_safety_die "Recusado: --from aponta para o checkout vivo; use uma build isolada."
  [[ -f "$build_directory/.next/BUILD_ID" ]] \
    || runtime_safety_die "Build ausente: $build_directory/.next/BUILD_ID não existe."
  mkdir -p "$run_directory"
else
  build_directory="$run_directory/build"
  mkdir -p "$build_directory"
  step "Cópia isolada em $build_directory"
  # Dados pessoais, segredos, Git e builds antigas nunca entram na cópia.
  # Padrões com "/" ancoram na raiz: uma pasta de código chamada data continua.
  rsync -a \
    --exclude /node_modules --exclude '/.next*' --exclude /data --exclude /.worktrees \
    --exclude '.env*' --exclude .git \
    "$live_directory/" "$build_directory/"
  # Hardlink, não symlink: o Turbopack não resolve node_modules por symlink.
  cp -al "$live_directory/node_modules" "$build_directory/node_modules"

  step "Gates (typegen, tsc, lint, testes)"
  bash "$build_directory/scripts/pre-deploy.sh" --skip-build

  step "Build com NEXT_PUBLIC_BASE_PATH=$base_path"
  (cd "$build_directory" && NEXT_PUBLIC_BASE_PATH="$base_path" "$npm_bin" run build)
  [[ -f "$build_directory/.next/BUILD_ID" ]] || runtime_safety_die "O build não gerou .next/BUILD_ID."
fi

live_next="$live_directory/.next"
backup_next="$run_directory/next-before"
new_next="$run_directory/next-new"
previous_build_id="$(build_id_of "$live_next")"
new_build_id="$(build_id_of "$build_directory/.next")"

step "Preparando $new_build_id (atual: $previous_build_id)"
cp -a "$build_directory/.next" "$new_next"
if [[ -d "$live_next/static" ]]; then
  cp -a --update=none "$live_next/static/." "$new_next/static/"
fi

step "Trocando a .next (backup em $backup_next)"
[[ -d "$live_next" ]] && mv "$live_next" "$backup_next"
mv "$new_next" "$live_next"

step "Reiniciando $service_name"
"$systemctl_bin" restart "$service_name"

if ! wait_for_health "$local_health_url"; then
  printf 'ERRO: health local falhou; restaurando a build anterior.\n' >&2
  mv "$live_next" "$run_directory/next-failed"
  [[ -d "$backup_next" ]] && mv "$backup_next" "$live_next"
  "$systemctl_bin" restart "$service_name"
  printf 'Build anterior (%s) restaurada; a que falhou ficou em %s.\n' \
    "$previous_build_id" "$run_directory/next-failed" >&2
  exit 1
fi
step "Health local 200"

if ! wait_for_health "$public_health_url"; then
  printf 'ERRO: health público falhou com o local em 200; build nova mantida. Conferir Apache/rede.\n' >&2
  exit 1
fi
step "Health público 200"

cat <<EOF

Publicado: $new_build_id (antes: $previous_build_id)
Build de origem (não apagar): $build_directory
Backup: $backup_next
Rollback: mv "$live_next" "$run_directory/next-rolled-back" && mv "$backup_next" "$live_next" && systemctl restart $service_name
EOF
