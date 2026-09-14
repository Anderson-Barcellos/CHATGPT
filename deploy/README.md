# Cápsula de deploy — Gaúcho Chat

Formato calibrado no piloto Mindlog (MAPA em `/root/MIGRACAO.md`, F3).

| | |
|---|---|
| Porta | 3040 (loopback), `chatgpt.service` (`npm start` = `next start`) |
| Rota | `/chat` e `/chat/api` via `snippets/chat.conf`; basePath `/chat` fica baked no build |
| Units | `systemd/chatgpt.service`, `chatgpt-pulse.{service,timer}` (1 min), `chatgpt-soundcase.{service,timer,path}` |
| Dados persistentes | `data/` (JSON + `soundcase/` + `memory-index/` LanceDB), `/root/studio-projects/{active,archive}` (dono `studio`) |
| Secrets | `.env.production` (0600; nomes em `.env.example`). Viaja por rsync no script de push, nunca pelo git |
| Deps de sistema | ffmpeg/ffprobe, jq, psmisc (`fuser`), build-essential (nativos), **google-chrome-stable** (`/chat/api/artifacts/pdf`), usuário `studio`, `/opt/studio-venv`, `/workspace`, `/var/log/chatgpt/` |

## Instalar

```bash
bash deploy/install.sh              # idempotente; SKIP_BUILD=1 pula npm ci + build; SKIP_CHROME=1 pula o Chrome
```

Depois, uma vez por host: `Include snippets/chat.conf` dentro do `<VirtualHost *:443>`,
`apache2ctl configtest`, `systemctl reload apache2`, registrar em `/etc/apache2/APACHE.md`.

## Validar

`curl -s http://127.0.0.1:3040/chat/api/health` → `status: healthy`; `https://<host>/chat` → 200 (tela de login);
`systemctl is-active chatgpt chatgpt-pulse.timer chatgpt-soundcase.timer chatgpt-soundcase.path`;
`npm test` (vitest), `npx tsc --noEmit`, `npm run lint` no repo.

## Dívidas conhecidas

- `NEXT_PUBLIC_APP_URL=https://ultrassom.ai/chat` está fixo na unit e baked no build: em staging
  (`sonaris.us`) os links absolutos e o redirect do Google OAuth apontam pro domínio final.
- `scripts/studio-venv-requirements.txt` é o kit mínimo; `deploy/studio-venv-freeze.txt` é o venv real
  do host de origem (ipykernel, numpy, matplotlib…). O install aplica os dois.
- Sem logrotate em `/var/log/chatgpt/` (pulse.log passou de 100 MB no host velho).
- `playwright` no `package.json` puxaria browsers no postinstall; o install exporta
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` porque o PDF usa o Chrome do sistema.
