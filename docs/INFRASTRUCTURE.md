# Infraestrutura

**Última atualização:** 2026-08-06
**Produção:** `https://ultrassom.ai/chat`
**Porta local:** `3040`

## Topologia

```text
Internet
  -> Apache2 HTTPS :443
  -> /chat, /chat/studio e /chat/api/* proxy para http://localhost:3040/chat
  -> Next.js 16 via chatgpt.service
  -> OpenAI/DeepSeek/Gemini APIs + JSON store local
```

O `<Location /chat>` mantém `ProxyPassReverseCookiePath / /chat` escopado ao serviço e alinha a CSP do Apache à política emitida pelo Next. `script-src blob:` e `worker-src 'self' blob:` são necessários para Monaco e para o runner local do Studio; não mover essas diretivas para o nível global do vhost. O script autenticado do runner em `/chat/api/studio/runner` acrescenta uma CSP mais restrita, com `connect-src 'none'`, que continua valendo pela interseção das políticas.

## Fontes Canônicas

| Item | Caminho |
|---|---|
| Registro geral de rotas/portas | `/etc/apache2/APACHE.md` |
| Vhost Apache ativo | `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf` |
| Fonte versionada do service | `systemd/chatgpt.service` |
| Unit instalada | `/etc/systemd/system/chatgpt.service` |
| Exemplo versionado de proxy | `apache-config/chat.conf` |
| Env de produção | `.env.production` |
| Logs do app | `/var/log/chatgpt/app.log`, `/var/log/chatgpt/error.log` |

Não transcreva segredos de `.env.production` ou `.env.local` em docs, issues ou commits.
O nome público do app é `Gaucho Chat`; a descrição `Celer - Cliente IA Multi-Modal` na unit systemd é apenas um rótulo histórico interno.
O repositório nao usa mais stack de deploy por Docker/Nginx; o runtime valido aqui e Apache + `chatgpt.service`.
OpenAI, DeepSeek V4 Pro e Gemini 3.6 Flash são acessados apenas server-side; suas chaves não devem aparecer no cliente nem em logs.

## Apache

O Apache serve `ultrassom.ai` e repassa o app para o Next local.

Regras essenciais para `/chat`:

```apache
ProxyPass        /chat/api/ http://localhost:3040/chat/api/
ProxyPassReverse /chat/api/ http://localhost:3040/chat/api/
ProxyPass        /chat/api http://localhost:3040/chat/api
ProxyPassReverse /chat/api http://localhost:3040/chat/api
ProxyPass        /chat http://localhost:3040/chat
ProxyPassReverse /chat http://localhost:3040/chat

<Location /chat>
    # CookiePath DENTRO do Location — solto no vhost, reescreve o Path dos
    # cookies de TODOS os serviços do ultrassom.ai (quebrou o Sonaris em 2026-07)
    ProxyPassReverseCookiePath / /chat
    Require all granted
    Header always set X-Forwarded-SSL on
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "ultrassom.ai"
</Location>
```

Pontos críticos:

- O app faz auth no Next; Apache fica como reverse proxy para `/chat`.
- `ProxyPassReverseCookiePath / /chat` precisa ficar sem barra final **e DENTRO do `<Location /chat>`** — no nível do vhost ela reescreve o `Path` dos cookies de todos os outros serviços do domínio (incidente 2026-07-11: 401 nas imagens do Sonaris).
- `Path=/chat/` causa loop no mobile porque autentica `/chat/login`, mas não `/chat`.
- Não adicionar rewrite de trailing slash para `/chat`.
- Se editar o vhost ativo, ele pode estar protegido com `chattr +i`; remova a proteção, edite, valide, recarregue e recoloque.

Comandos úteis:

```bash
apachectl configtest
systemctl reload apache2
systemctl is-active apache2
```

## Systemd

`chatgpt.service` roda `npm start` em `/root/CHATGPT`.

Configuração relevante:

```ini
WorkingDirectory=/root/CHATGPT
Environment="NODE_ENV=production"
Environment="PORT=3040"
Environment="NEXT_PUBLIC_BASE_PATH=/chat"
EnvironmentFile=/root/CHATGPT/.env.production
ExecStartPre=/bin/bash -c 'fuser -k 3040/tcp 2>/dev/null; sleep 1; exit 0'
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=15
StandardOutput=append:/var/log/chatgpt/app.log
StandardError=append:/var/log/chatgpt/error.log
```

Comandos:

```bash
systemctl restart chatgpt.service
systemctl status chatgpt.service --no-pager
journalctl -u chatgpt.service -n 80 --no-pager
```

## Variáveis de Ambiente

Obrigatórias em produção:

| Variável | Propósito |
|---|---|
| `OPENAI_API_KEY` | Chave server-side da OpenAI |
| `DEEPSEEK_API_KEY` | Chave server-side do DeepSeek V4 Pro para chat padrão e autocomplete FIM do Studio |
| `GEMINI_API_KEY` | Chave server-side do Gemini 3.6 Flash para chat padrão |
| `NEXT_PUBLIC_BASE_PATH` | Deve ser `/chat` |
| `NEXT_PUBLIC_APP_URL` | URL pública completa |
| `PORT` | Deve ser `3040` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Segredo para assinar sessão |

Overrides opcionais:

| Variável | Propósito |
|---|---|
| `DEEPSEEK_WEB_CONTEXT_MODEL` | Modelo OpenAI usado pelo helper `fresh_web_context`; fallback `gpt-5.6-luna` |

Integração Google Calendar:

Nota atual: Pulse nativo é o gestor recorrente visível do Gaucho Chat. Google Calendar permanece legado até remoção/limpeza futura.

Pulse:

| Variável | Propósito |
|---|---|
| `PULSE_RUNNER_TOKEN` | Token opcional para proteger `/api/pulse/run-due`; usado por `chatgpt-pulse.service` |
| `PULSE_RUNNER_URL` | Override opcional do endpoint local do runner |
| `PULSE_EXTRACT_MODEL` | Modelo opcional para interpretar prompts de rotina |
| `PULSE_RUN_MODEL` | Override opcional global; sem ele, cada rotina escolhe Mini (default) ou Terra |
| `PULSE_MAX_OUTPUT_TOKENS` | Orçamento de saída do runner; default `25000`, limitado entre 8k e 32k |
| `PULSE_REASONING_EFFORT` | Override opcional de effort; default `medium`, com `none`/`minimal` coeridos para `low` |

Transcrição:

| Variável | Propósito |
|---|---|
| `TRANSCRIPTION_STREAMING_ENABLED` | `true` por padrão; `false` força resposta final `{ text }` sem NDJSON |

| Variável | Propósito |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID do Google |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret do Google, server-side |
| `GOOGLE_OAUTH_REDIRECT_URI` | Callback público, normalmente `https://ultrassom.ai/chat/api/integrations/google/auth/callback` |
| `GOOGLE_CALENDAR_DEFAULT_ID` | Calendário padrão, normalmente `primary` |
| `GOOGLE_CALENDAR_DEFAULT_TIME_ZONE` | Timezone padrão, normalmente `America/Sao_Paulo` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Chave para criptografar tokens locais do Google |

Arquivos runtime privados novos:

| Arquivo | Propósito |
|---|---|
| `data/google-calendar-token.json` | Token Google criptografado, permissão `0600` quando escrito pelo app |
| `data/calendar-event-drafts.json` | Rascunhos locais de criação/alteração/cancelamento |
| `data/workspace-notes.json` | Notas locais globais/capturas |
| `data/pulse-tasks.json` | Rotinas Pulse recorrentes |
| `data/pulse-runs.json` | Histórico de execuções Pulse |

Auth do app:

| Variável | Propósito |
|---|---|
| `AUTH_ENABLED` | Liga/desliga gate do app |
| `AUTH_USERNAME` | Usuário aceito pelo login |
| `AUTH_PASSWORD` | Senha aceita pelo login |

Rate limit:

| Variável | Propósito |
|---|---|
| `RATE_LIMIT_ENABLED` | Liga/desliga rate limit |
| `RATE_LIMIT_CHAT_RPM` | Limite específico de chat |
| `RATE_LIMIT_STUDIO_RPM` | Limite específico do assistente contextual do Studio |
| `RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM` | Limite do autocomplete FIM do Studio; default `180` |
| `RATE_LIMIT_TRANSCRIBE_RPM` | Limite específico de transcrição |
| `RATE_LIMIT_LOGIN_RPM` | Limite específico de login |

## Deploy e Validação

Fluxo comum:

```bash
cd /root/CHATGPT
npm test
npx tsc --noEmit
npm run build
systemctl restart chatgpt.service
curl -s http://127.0.0.1:3040/chat/api/health
curl -s https://ultrassom.ai/chat/api/health
```

Para mudanças no Apache:

```bash
apachectl configtest
systemctl reload apache2
curl -I https://ultrassom.ai/chat
```

Para validar auth pública:

```bash
curl -i -c /tmp/chat.cookies \
  -H 'Content-Type: application/json' \
  -d '{"username":"<usuario>","password":"<senha>"}' \
  https://ultrassom.ai/chat/api/auth/login

curl -b /tmp/chat.cookies https://ultrassom.ai/chat/api/auth/check
```

Nunca coloque as credenciais reais nesses comandos quando eles forem virar documentação, issue ou PR.

## Troubleshooting

| Sintoma | Checagem |
|---|---|
| `/chat` retorna 503 | `systemctl status chatgpt.service --no-pager` e health local |
| Loop `/chat` e `/chat/login` | Confirmar `Set-Cookie: Path=/chat`, sem barra final |
| Porta 3040 ocupada | `fuser -k 3040/tcp` ou reiniciar `chatgpt.service` |
| API retorna 401 | Verificar `AUTH_ENABLED`, cookie `auth-token` e `/api/auth/check` |
| Áudio/TTS falha | Conferir `/chat/api/tts`, console do browser e política de autoplay |

## Registro de Portas

Antes de alocar portas novas, consulte `/etc/apache2/APACHE.md` e use:

```bash
/etc/apache2/check-port.sh 3040
/etc/apache2/check-port.sh --list
/etc/apache2/check-port.sh --reserved
```
