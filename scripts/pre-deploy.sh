#!/usr/bin/env bash

# Executa gates somente em um checkout que não seja o runtime vivo.
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

skip_build=false
for argument in "$@"; do
  case "$argument" in
    --skip-build) skip_build=true ;;
    *) runtime_safety_die "Argumento desconhecido: $argument" ;;
  esac
done

# Esta é deliberadamente a primeira operação após validar argumentos: mesmo
# --skip-build não pode consultar ou modificar o checkout em produção.
runtime_safety_require_isolated_checkout "$project_directory"

[[ -f "$project_directory/package.json" ]] || runtime_safety_die "package.json não encontrado."
[[ -d "$project_directory/node_modules" ]] || runtime_safety_die "node_modules ausente; instale as dependências explicitamente antes de executar este script."

npm_bin="${GAUCHO_NPM_BIN:-npm}"
npx_bin="${GAUCHO_NPX_BIN:-npx}"
tsc_bin="${GAUCHO_TSC_BIN:-$project_directory/node_modules/.bin/tsc}"

run_gate() {
  local label="$1"
  shift
  printf '→ %s\n' "$label"
  "$@"
}

cd "$project_directory"
run_gate "Tipos do Next" "$npx_bin" --no-install next typegen
run_gate "TypeScript" "$tsc_bin" --noEmit
run_gate "ESLint" "$npm_bin" run lint
run_gate "Testes" "$npm_bin" test

if [[ "$skip_build" == true ]]; then
  printf 'Build não executado por --skip-build; esta rodada não certifica entrega.\n'
  exit 0
fi

run_gate "Build" "$npm_bin" run build
printf 'Gates concluídos no checkout isolado.\n'
