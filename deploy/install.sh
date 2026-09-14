#!/usr/bin/env bash
# Gaúcho Chat — instalação idempotente no host (cápsula de migração, F3 do MAPA em /root/MIGRACAO.md).
# Uso (root, de qualquer cwd):  bash deploy/install.sh
#   SKIP_BUILD=1 bash deploy/install.sh   → pula npm ci + next build (.next já existente)
#   SKIP_CHROME=1                          → não instala google-chrome-stable (PDF de artefatos fica sem renderizador)
# Faz: deps de sistema (ffmpeg, jq, psmisc, google-chrome-stable) → npm ci + next build →
#      Studio (usuário studio, /opt/studio-venv congelado, /workspace) → /var/log/chatgpt →
#      units + timers + path (fontes em systemd/) → enable --now + restart →
#      snippet Apache em /etc/apache2/snippets/chat.conf → checa /chat/api/health na 3040.
# Não faz: Include do snippet no vhost (passo consciente por host, ver deploy/README.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
UNIT_DIR=/etc/systemd/system
SNIPPET_DIR=/etc/apache2/snippets
LOG_DIR=/var/log/chatgpt
VENV_DIR=/opt/studio-venv
FREEZE="$ROOT/deploy/studio-venv-freeze.txt"
export DEBIAN_FRONTEND=noninteractive
# O pacote `playwright` baixaria ~400 MB de browsers no postinstall; o app usa o Chrome do sistema.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

log()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
warn() { printf '\033[33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31mxx %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "rodar como root"
command -v node >/dev/null || die "node ausente"
command -v npm  >/dev/null || die "npm ausente"
[[ "$(node -v)" == v22.* ]] || warn "node $(node -v): o projeto foi validado com v22"

log "1/8 Configuração"
[[ -f "$ENV_FILE" ]] || die "falta $ENV_FILE — copiar .env.example, preencher e chmod 600"
chmod 600 "$ENV_FILE"
for v in JWT_SECRET AUTH_PASSWORD OPENAI_API_KEY PULSE_RUNNER_TOKEN SOUNDCASE_WORKER_TOKEN; do
  grep -qE "^$v=." "$ENV_FILE" || warn "$v vazio em .env.production (runner/worker devolvem 503 sem token)"
done
install -d -m 755 "$LOG_DIR" "$ROOT/data" "$ROOT/data/soundcase"
echo "env: $ENV_FILE | logs: $LOG_DIR | dados: $ROOT/data"

log "2/8 Dependências de sistema (ffmpeg, jq, psmisc, build-essential p/ nativos, google-chrome-stable p/ PDF)"
pkgs=(ffmpeg jq psmisc curl build-essential python3 python3-venv ca-certificates gnupg)
missing=(); for p in "${pkgs[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if ((${#missing[@]})); then apt-get update -qq && apt-get install -y -qq "${missing[@]}"; fi
if [[ "${SKIP_CHROME:-0}" != "1" && ! -x /usr/bin/google-chrome-stable ]]; then
  install -d -m 755 /usr/share/keyrings
  curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list
  apt-get update -qq && apt-get install -y -qq google-chrome-stable
fi
[[ -x /usr/bin/google-chrome-stable ]] && echo "chrome: $(/usr/bin/google-chrome-stable --version 2>/dev/null)" || warn "sem google-chrome-stable: /chat/api/artifacts/pdf vai falhar"

log "3/8 Node (npm ci + next build; nativos better-sqlite3/node-pty/lancedb recompilam aqui)"
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  warn "SKIP_BUILD=1: npm ci e build pulados"
else
  (cd "$ROOT" && npm ci --no-audit --no-fund --loglevel=error && NODE_ENV=production NEXT_PUBLIC_BASE_PATH=/chat npm run build)
fi
[[ -f "$ROOT/.next/BUILD_ID" ]] || die ".next/BUILD_ID ausente: build falhou"

log "4/8 Studio (usuário studio, /opt/studio-venv, /workspace, /root/studio-projects)"
bash "$ROOT/scripts/studio-workspace-setup.sh"
if [[ -f "$FREEZE" ]]; then
  # O requirements versionado é o kit mínimo; o freeze é o venv real do host de origem (ipykernel, numpy…).
  "$VENV_DIR/bin/pip" install --quiet --require-virtualenv -r "$FREEZE"
  chmod -R a+rX "$VENV_DIR"
  echo "venv completado a partir de deploy/studio-venv-freeze.txt ($(wc -l < "$FREEZE") pacotes)"
fi

log "5/8 Units systemd (fontes: systemd/)"
for u in chatgpt.service chatgpt-pulse.service chatgpt-pulse.timer chatgpt-soundcase.service chatgpt-soundcase.timer chatgpt-soundcase.path; do
  install -m 644 "$ROOT/systemd/$u" "$UNIT_DIR/$u"
done
systemctl daemon-reload
systemctl enable --now chatgpt.service chatgpt-pulse.timer chatgpt-soundcase.timer chatgpt-soundcase.path >/dev/null 2>&1
systemctl restart chatgpt.service   # pega build/código novos mesmo se já estava ativo

log "6/8 Snippet Apache → $SNIPPET_DIR/chat.conf (instalado, NÃO incluído no vhost)"
install -d -m 755 "$SNIPPET_DIR"
install -m 644 "$ROOT/deploy/apache-chat.conf" "$SNIPPET_DIR/chat.conf"

log "7/8 Verificação"
code=000
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3040/chat/api/health || true)
  [[ "$code" == "200" ]] && break
  sleep 1
done
if [[ "$code" == "200" ]]; then
  curl -s http://127.0.0.1:3040/chat/api/health | python3 -c 'import json,sys;d=json.load(sys.stdin);print("3040 vivo:",d["status"],"|",", ".join(k+"="+str(v.get("status")) for k,v in d.get("checks",{}).items()))'
else
  tail -n 30 "$LOG_DIR/error.log" 2>/dev/null || journalctl -u chatgpt --no-pager -n 20
  die "3040 não respondeu 200 em /chat/api/health em 60 s (último código $code)"
fi
ui=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3040/chat)
echo "UI /chat: $ui | chatgpt=$(systemctl is-active chatgpt) | pulse.timer=$(systemctl is-active chatgpt-pulse.timer) | soundcase.timer=$(systemctl is-active chatgpt-soundcase.timer) | soundcase.path=$(systemctl is-active chatgpt-soundcase.path)"

log "8/8 Pronto"
echo "Uma vez por host: 'Include snippets/chat.conf' no <VirtualHost *:443>, apache2ctl configtest, systemctl reload apache2. Registrar em /etc/apache2/APACHE.md."
