# Cápsula de deploy — Gaúcho Chat

Formato calibrado no piloto Mindlog (MAPA em `/root/MIGRACAO.md`, F3).

| | |
|---|---|
| Porta | 3040 (loopback), `chatgpt.service` (`npm start` = `next start`) |
| Rota | `/chat` e `/chat/api` via `snippets/chat.conf`; basePath `/chat` fica baked no build |
| Units | `systemd/chatgpt.service`, `chatgpt-pulse.{service,timer}` (1 min), `chatgpt-soundcase.{service,timer,path}`, `chatgpt-discover.{service,timer}` (08h BRT) |
| Dados persistentes | `data/` (JSON + `soundcase/` + `memory-index/` LanceDB), `/root/studio-projects/{active,archive}` (dono `studio`) |
| Secrets | `.env.production`, `/etc/chatgpt/xai.env` e `/etc/chatgpt/discover.env` (root:root, 0600). Provisionamento seguro fora do Git, sem emitir conteúdo |
| Deps de sistema | ffmpeg/ffprobe, jq, psmisc (`fuser`), build-essential (nativos), **google-chrome-stable** (`/chat/api/artifacts/pdf`), usuário `studio`, `/opt/studio-venv`, `/workspace`, `/var/log/chatgpt/` |

## Instalar

O domínio padrão é `https://sonaris.us/chat`. Provisionar os três arquivos privados antes da instalação. O instalador copia `deploy/host-environment.conf` para `/etc/chatgpt/host.env` e instala os drop-ins `20-xai`, `30-discover` e `40-host`; o último alinha a URL pública e o callback Google mesmo quando a configuração privada foi herdada do host antigo. O callback precisa estar autorizado no cliente OAuth do Google se essa integração for usada.

```bash
bash deploy/install.sh              # idempotente; SKIP_BUILD=1 pula npm ci + build; SKIP_CHROME=1 pula o Chrome
ENABLE_DISCOVER_TIMER=1 bash deploy/install.sh  # somente no host escolhido para executar curadoria
```

Depois, uma vez por host: `Include snippets/chat.conf` dentro do `<VirtualHost *:443>`,
`apache2ctl configtest`, `systemctl reload apache2`, registrar em `/etc/apache2/APACHE.md`.

## Validar

`curl -s http://127.0.0.1:3040/chat/api/health` → `status: healthy`; `https://<host>/chat` → 200 (tela de login);
`systemctl is-active chatgpt chatgpt-pulse.timer chatgpt-soundcase.timer chatgpt-soundcase.path`;
`npm test` (vitest), `npx tsc --noEmit`, `npm run lint` no repo.

## Dívidas conhecidas

- O cliente OAuth Google é externo ao servidor: cadastrar o callback `https://sonaris.us/chat/api/integrations/google/auth/callback` antes de uma nova conexão, caso o Calendar legado seja usado.
- `scripts/studio-venv-requirements.txt` é o kit mínimo; `deploy/studio-venv-freeze.txt` é o venv real
  do host de origem (ipykernel, numpy, matplotlib…). O install aplica os dois.
- Sem logrotate em `/var/log/chatgpt/` (pulse.log passou de 100 MB no host velho).
- `playwright` no `package.json` puxaria browsers no postinstall; o install exporta
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` porque o PDF usa o Chrome do sistema.
