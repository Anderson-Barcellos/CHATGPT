#!/usr/bin/env bash
# Provisionamento idempotente do Gaucho Studio Python Workspace.
# Cria o usuário de sandbox, as pastas do workspace, o venv base e o
# template inicial. Seguro de rodar mais de uma vez.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="/root/studio-projects"
ACTIVE_DIR="$BASE_DIR/active"
ARCHIVE_DIR="$BASE_DIR/archive"
# Venv fora de /root: o usuário de sandbox precisa atravessar o caminho e o
# systemd-run valida o executável no host antes de montar o namespace.
# ProtectSystem=strict já entrega o venv read-only dentro da jaula.
VENV_DIR="/opt/studio-venv"
MOUNTPOINT="/workspace"
TEMPLATE_DIR="$REPO_DIR/templates/studio-python"
REQUIREMENTS_FILE="$REPO_DIR/scripts/studio-venv-requirements.txt"
RUN_USER="studio"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERRO: rode como root (o serviço chatgpt.service roda como root)." >&2
  exit 1
fi

echo "== Usuário de sandbox =="
if id "$RUN_USER" &>/dev/null; then
  echo "Usuário '$RUN_USER' já existe."
else
  useradd --system --shell /usr/sbin/nologin --no-create-home "$RUN_USER"
  echo "Usuário '$RUN_USER' criado."
fi

echo "== Pastas =="
mkdir -p "$ACTIVE_DIR" "$ARCHIVE_DIR"
chmod 755 "$BASE_DIR"
chmod 700 "$ARCHIVE_DIR"
# Mountpoint fixo do BindPaths; fica vazio no host e só ganha conteúdo
# dentro do namespace da unit transient.
mkdir -p "$MOUNTPOINT"
chmod 755 "$MOUNTPOINT"
echo "Pastas em $BASE_DIR e mountpoint $MOUNTPOINT prontos."

echo "== Venv base =="
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
  echo "Venv criado em $VENV_DIR."
else
  echo "Venv já existe em $VENV_DIR."
fi
if [[ -f "$REQUIREMENTS_FILE" ]]; then
  "$VENV_DIR/bin/pip" install --quiet --require-virtualenv -r "$REQUIREMENTS_FILE"
  echo "Pacotes instalados a partir de $REQUIREMENTS_FILE."
else
  "$VENV_DIR/bin/pip" install --quiet --require-virtualenv openai httpx rich python-dotenv
  "$VENV_DIR/bin/pip" freeze --require-virtualenv > "$REQUIREMENTS_FILE"
  echo "Kit base instalado; versões congeladas em $REQUIREMENTS_FILE."
fi
# O usuário de sandbox só precisa ler/executar o venv (bind read-only).
chmod -R a+rX "$VENV_DIR"

echo "== Template inicial =="
if [[ -z "$(ls -A "$ACTIVE_DIR" 2>/dev/null)" ]]; then
  cp -r "$TEMPLATE_DIR/." "$ACTIVE_DIR/"
  echo "Template copiado para $ACTIVE_DIR."
else
  echo "Workspace ativo já tem conteúdo; template não sobrescreve."
fi
chown -R "$RUN_USER:$RUN_USER" "$ACTIVE_DIR"

echo "== Resumo =="
echo "active:  $ACTIVE_DIR ($(ls -A "$ACTIVE_DIR" | wc -l) entradas, dono $(stat -c '%U' "$ACTIVE_DIR"))"
echo "archive: $ARCHIVE_DIR"
echo "venv:    $("$VENV_DIR/bin/python" --version 2>&1)"
echo "Pronto."
