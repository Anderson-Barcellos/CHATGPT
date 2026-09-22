#!/usr/bin/env bash

# Guardas compartilhadas por ferramentas que podem iniciar builds ou runtimes.
# O serviço em execução é a fonte de verdade para o checkout de produção.

runtime_safety_die() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

runtime_safety_canonical_directory() {
  local directory="$1"

  [[ -d "$directory" ]] || runtime_safety_die "Diretório inexistente: $directory"
  (
    cd "$directory"
    pwd -P
  )
}

runtime_safety_live_working_directory() {
  local systemctl_bin="${GAUCHO_SYSTEMCTL_BIN:-systemctl}"
  local service_name="${GAUCHO_RUNTIME_SERVICE:-chatgpt.service}"
  local working_directory

  if ! working_directory="$("$systemctl_bin" show "$service_name" --property=WorkingDirectory --value)"; then
    runtime_safety_die "Não foi possível consultar o WorkingDirectory vivo de $service_name."
  fi

  [[ -n "$working_directory" ]] || runtime_safety_die "O WorkingDirectory vivo de $service_name está vazio."
  runtime_safety_canonical_directory "$working_directory"
}

runtime_safety_require_isolated_checkout() {
  local project_directory
  local live_working_directory

  project_directory="$(runtime_safety_canonical_directory "$1")"
  live_working_directory="$(runtime_safety_live_working_directory)"

  if [[ "$project_directory" == "$live_working_directory" ]]; then
    runtime_safety_die "Recusado: este script não pode operar no checkout usado por ${GAUCHO_RUNTIME_SERVICE:-chatgpt.service}."
  fi
}
