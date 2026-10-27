# Infraestrutura

**Última atualização:** 2026-10-27 (avatares de provider publicados)
**Produção:** `https://sonaris.us/chat` — host `srv1927271`
**Porta local:** `3040`

## Topologia

Publicação atual em 27/10 (noite), autorizada por Anders: avatares de Claude e DeepSeek passam a usar os logos SVG do Simple Icons (CC0), monocromáticos como o da OpenAI; Gemini mantém a inicial. Primeira build com DeepSeek `low`, igual ao git main. Build `v33VHEZLnntZ8uAp4lyOi`; origem `/root/.cache/gaucho-git-sync-20261027/source` (NÃO apagar: a `.next` viva referencia esse caminho). `scripts/deploy.sh --from`, exit 0; apenas `chatgpt.service` reiniciado, saúde local/pública 200, timers, path SoundCase e `chatgpt-transcription.service` ativos, chunk público com os logos idêntico ao local. Sem alteração de portas, proxy, cookies, credenciais, dados privados ou Apache. As fontes e backups de deploy anteriores entram na faxina autorizada por Anders (git main é a fonte de verdade).

Publicação anterior em 27/10 (tarde): avatares do assistente crescem para 28 px mobile/34 px desktop e identificam OpenAI, Anthropic/Claude, DeepSeek ou Google/Gemini pelo modelo que gerou a resposta. Build `NA3hXvWqxXMoGrvOjAOKz`; origem `/root/worktrees/gaucho-panel-width` (preservar), backup `/root/.cache/gaucho-deploy/20261027T171232Z/next-before`. `scripts/deploy.sh --from`, exit 0; apenas `chatgpt.service` reiniciado, estado active e saúde local/pública 200 healthy. Chrome público com conversa sintética confirmou os quatro providers a 1440 px (34 px) e 390 px (28 px), sem erros de console; APIs interceptadas, sem provedor pago ou dados pessoais como fixture. Timers Pulse/SoundCase/Discover, path SoundCase e `chatgpt-transcription.service` seguem ativos. Sem alteração de portas, proxy, cookies, credenciais, dados privados ou Apache. DeepSeek max preservado. Evidências em `/root/.cache/gaucho-panel-width/evidence/provider-avatar-20261027`.

Publicação anterior em 24/10: até 1280 px inclusive o painel direito usa gaveta sobreposta de até 500 px; a lateral fixa 500/640 px começa em 1281 px. A gaveta e o overlay ficam invisíveis no mesmo quadro da transição e o portal desmonta em seguida, sem duplicação visual. Build `3J21jZ5MCLYeOKGSR5bqL`, fonte `/root/worktrees/gaucho-panel-width` (preservar), backup `/root/.cache/gaucho-deploy/20261024T172502Z/next-before`. `scripts/deploy.sh --from`, exit 0; somente `chatgpt.service` reiniciado, saúde local/pública 200 healthy e interface pública em 1200/1280/1281/3440/390/320 px aprovada com APIs sintéticas. 27 assets JS/CSS/fontes e `pcm-recorder.js` idênticos. Agendadores restaurados e ponte de ditado com o mesmo PID. Sem alteração de portas, proxy, cookies, credenciais, dados privados ou reload Apache. DeepSeek max preservado no runtime, código low intacto no checkout. Evidências em `/root/.cache/gaucho-panel-width/evidence`.

Publicação inicial do Descobrir no painel em 24/10 (histórico): build `b4ktfW70_c06rmYJTV40E`, fonte `/root/.cache/gaucho-discover-context-deploy/source` (preservar), backup `/root/.cache/gaucho-deploy/20261024T161910Z/next-before`. Publicação dirigida via `scripts/deploy.sh --from`, exit 0; somente `chatgpt.service` reiniciado, saúde local/pública 200 healthy e interface pública 1440/390 px validada com APIs sintéticas. 27 assets JS/CSS/fontes e `pcm-recorder.js` idênticos aos arquivos validados. Agendadores pausados apenas durante a troca e restaurados; ponte de ditado preservou o PID. DeepSeek max preservado; evidências em `/root/.cache/gaucho-discover-context-deploy/evidence`.

Refinamento do gesto em 21/10 (histórico): build `VpqUQkfWDgyJNn4Tx8i-w`, origem `/root/.cache/gaucho-press-20261021/source` (preservar), backup `/root/.cache/gaucho-deploy/20261021T172749Z/next-before`. Restart de `chatgpt.service` com health local/público 200; agendadores restaurados. Mantida a mesma base funcional, incluindo DeepSeek `max`.

Publicação mobile em 21/10: build `6dxYdQfcARJRrT0-1qEkK`, fonte `/root/.cache/gaucho-mobile-20261021/source` (preservar), backup `/root/.cache/gaucho-deploy/20261021T163104Z/next-before`. Serviço reiniciado, health local/público 200 healthy e assets novos conferidos byte a byte. Agendadores pausados somente durante a troca e restaurados ao estado anterior. Sem mudança de porta, proxy, DNS, credenciais ou dados pessoais. A build preserva o DeepSeek `max` publicado anteriormente; seis arquivos `low` do checkout são WIP de outra frente e não representam esse comportamento vivo. Os registros antigos abaixo são históricos.

Publicação de segurança: fonte `2584921`, build `fQ5aGOE2G9BIiCdmil9-L`, unit instalada sem `fuser`, serviço reiniciado e readiness/liveness local e público 200. Autenticação obrigatória, locks exclusivos e propriedade das novas sessões Studio estão ativos. Agendadores restaurados após o corte, sem sessões legadas ativas. Backup da build anterior e da unit em `/root/.cache/gaucho-security-deploy-20260922`; 20 assets anteriores retidos. Domínio, proxy e cookies preservados. Evidência detalhada no relatório `docs/plans/2026-09-22-review-seguranca-operacao-report.md`.

```text
Internet
  -> Apache2 HTTPS :443
  -> /chat, /chat/studio e /chat/api/* proxy para http://localhost:3040/chat
  -> Next.js 16 via chatgpt.service
  -> OpenAI/xAI/DeepSeek/Gemini APIs + store local selecionado no servidor
```

O `<Location /chat>` mantém `ProxyPassReverseCookiePath / /chat` escopado ao serviço e alinha a CSP do Apache à política emitida pelo Next. `script-src blob:` e `worker-src 'self' blob:` continuam necessários para Monaco/Mermaid e seus workers; não mover essas diretivas para o nível global do vhost. O antigo runner local em `/chat/api/studio/runner` foi removido quando o Studio virou Python-only; execução, terminal e notebook passam pelas rotas autenticadas `/chat/api/studio/workspace/*` e por processos sandboxed no host.

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
OpenAI, DeepSeek V4.1 Flash, Gemini 3.8 Flash e a voz xAI são acessados apenas server-side; suas chaves não devem aparecer no cliente nem em logs.

A fundação Memory V2 E1/E2 está instalada no código, mas não ativa em produção. Sem `MEMORY_V2_ENABLED=true`, JSON continua como autoridade exclusiva. Com a flag, SQLite passa a ser a autoridade exclusiva; não existe dual-write. O CLI de migração é dry-run por padrão, nenhum dado real foi migrado e qualquer cutover exige uma entrega operacional própria.

## Apache

O domínio de destino do Gaúcho Chat é `sonaris.us`, com prefixo `/chat`. O Apache repassa o app para o Next local. Referências históricas a `ultrassom.ai` descrevem o servidor antigo.

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

Ditado Realtime publicado com autorização em 23/10/2026: `chatgpt-transcription.service` executa `scripts/transcription-server.ts` via tsx, somente em `127.0.0.1:3041`. Porta conferida pelo check-port.sh, agora ocupada exclusivamente pela ponte em loopback. Consome a mesma `.env.production` para `AUTH_ENABLED`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `JWT_SECRET` e `OPENAI_API_KEY`, sem criar outra credencial. `NEXT_PUBLIC_BASE_PATH=/chat`; `TRANSCRIPTION_PORT` permite porta isolada de QA. Boot recusa auth desativada ou chave ausente. `/health` local só comprova prontidão da ponte, não transcrição no provedor.

`deploy/apache-chat.conf` contém a rota específica `/chat/api/transcribe/realtime` antes das rotas genéricas, com upgrade WebSocket e Host preservado. `deploy/install.sh` instala e verifica a nova unit. Para publicação dirigida: promover os arquivos e dependências validados, instalar/ativar a unit, instalar snippet, executar `apache2ctl configtest` antes do reload e registrar a porta/serviço em `/etc/apache2/APACHE.md`. Reiniciar o Next com a build validada e a ponte com a mesma configuração; conferir saúde local/pública, autenticação e ditado completo. `scripts/deploy.sh` atualiza somente a build Next; não substitui a instalação da ponte/snippet. Não executar o instalador completo para uma atualização dirigida sem revisar seus efeitos em Studio/agendadores.

Configuração de destino (2026-10-11): os drop-ins `20-xai.conf` e `30-discover.conf` carregam as configurações privadas externas ao Git. `40-host.conf` carrega por último `/etc/chatgpt/host.env`, copiado de `deploy/host-environment.conf`, com `NEXT_PUBLIC_APP_URL=https://sonaris.us/chat`, prefixo `/chat` e callback Google explícito `https://sonaris.us/chat/api/integrations/google/auth/callback`. A URL explícita evita herdar o domínio anterior ou repetir o prefixo ao montar o callback. O cadastro externo do cliente OAuth precisa aceitar esse endereço para novas conexões. O timer Discover é instalado pelo provisionamento e só ativado explicitamente no host responsável pela curadoria; o interruptor do app continua controlando a pausa e a frequência de dois dias.

Registro histórico (2026-09-09): a publicação SoundCase SC3 usou a build isolada `ZvnMJP226jtiS-Y0va9fo`, produzida em `/root/.cache/soundcase-sc3-review-rd4pjy52`, com backup em `/root/.cache/chatgpt-next-before-sc3-20260909T042041Z` e evidência em `/root/.cache/sc3-deploy-result.json`. Esses caminhos descrevem aquela rodada, não a publicação atual; consultar o estado operacional no `BACKLOG.md` antes de qualquer rollback.

Configuração relevante:

```ini
WorkingDirectory=/root/CHATGPT
Environment="NODE_ENV=production"
Environment="PORT=3040"
Environment="NEXT_PUBLIC_BASE_PATH=/chat"
EnvironmentFile=/root/CHATGPT/.env.production
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
| `STUDIO_OPENAI_API_KEY` | Chave OpenAI de escopo restrito (limite de gasto próprio) que a jail do Studio recebe como `OPENAI_API_KEY` no runner, terminal e kernel; a chave principal nunca entra na jail. Sem ela, a jail fica sem chave alguma (`openai` dentro do Studio falha com erro de autenticação) |
| `DEEPSEEK_API_KEY` | Chave server-side do DeepSeek V4.1 Flash (`deepseek-flash`) para chat padrão e autocomplete FIM do Studio |
| `GEMINI_API_KEY` | Chave server-side do Gemini 3.8 Flash para chat padrão |
| `XAI_API_KEY` / `GROK_API_KEY` | Chave server-side xAI só para voz: TTS Orion (`/api/tts/xai`), Grok Realtime do Chat/Pulse e SoundCase. O Grok não é mais modelo de texto desde 2026-10-13; `XAI_API_KEY` tem precedência. Nunca enviar a chave permanente ao browser |
| `NEXT_PUBLIC_BASE_PATH` | Deve ser `/chat` |
| `NEXT_PUBLIC_APP_URL` | URL pública completa |
| `PORT` | Deve ser `3040` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Segredo para assinar sessão |

Overrides opcionais:

Para QA em worktree, iniciar o Next com `GAUCHO_ISOLATED_RUNTIME=true`, credenciais sintéticas explícitas e dados sintéticos exclusivos. A flag desabilita o Studio real, sem dispensar autenticação ou exclusividade. Usar porta loopback livre verificada por `/etc/apache2/check-port.sh` e base path `/chat`. Não aplicar a flag ao serviço principal.

O boot valida autenticação e adquire locks `flock` nos recursos canônicos de armazenamento (JSON, SoundCase, SQLite selecionado e Studio habilitado). Outro processo com um recurso compartilhado falha; saída do proprietário libera locks e perda inesperada do holder encerra o runtime. Não remover arquivos de lock enquanto o servidor estiver ativo. Cópias em hosts diferentes não compartilham locks: o corte operacional ainda exige um único agendador ativo e drenagem das execuções.

A configuração em `.bashrc` serve ao shell que a carrega; não disponibiliza automaticamente a variável no `chatgpt.service`. Desde a publicação autorizada de 2026-09-21, a credencial xAI é provisionada como `XAI_API_KEY` em `/etc/chatgpt/xai.env` (`root:root`, modo `0600`). O drop-in `/etc/systemd/system/chatgpt.service.d/20-xai.conf` carrega esse arquivo depois do env principal; fonte sem segredo em `systemd/chatgpt.service.d/20-xai.conf`. Provisionar o arquivo protegido antes de instalar o drop-in e executar `systemctl daemon-reload`; reiniciar o serviço somente no deploy autorizado. A chave não entra em `NEXT_PUBLIC_*`, logs ou Git. Pulse chama o backend desse mesmo serviço, portanto não precisa de outra cópia da chave.

| Variável | Propósito |
|---|---|
| `DEEPSEEK_WEB_CONTEXT_MODEL` | Modelo OpenAI usado pelo helper `fresh_web_context`; fallback `gpt-6-luna` |
| `MEMORY_V2_ENABLED` | Ativa SQLite como autoridade exclusiva de conversas; permanece desligada em produção |
| `MEMORY_V2_DATABASE_PATH` | Caminho opcional do banco SQLite; default `data/memory-v2.sqlite` |

Integração Google Calendar:

Nota atual: Pulse nativo é o gestor recorrente visível do Gaucho Chat. Google Calendar permanece legado até remoção/limpeza futura.

Pulse:

| Variável | Propósito |
|---|---|
| `PULSE_RUNNER_TOKEN` | Obrigatório: protege `/api/pulse/run-due` (sem ele a rota responde `503`); lido por `chatgpt-pulse.service` via `EnvironmentFile` e enviado como Bearer por `scripts/run-pulse-due.sh` |
| `PULSE_RUNNER_URL` | Override opcional do endpoint local do runner |
| `PULSE_EXTRACT_MODEL` | Modelo opcional para interpretar prompts de rotina; aceita vazio ou `gpt-6-luna` (padrão, reasoning `low`); `gpt-5.4-mini`/`grok-4.7` legados caem no Luna e outros valores falham. `CALENDAR_DRAFT_MODEL` segue a mesma regra para o rascunho de agenda |
| `PULSE_RUN_MODEL` | Override opcional global; sem ele, cada rotina escolhe Mini (default), Sol ou Terra |
| `PULSE_MAX_OUTPUT_TOKENS` | Orçamento de saída do runner; default `25000`, limitado entre 8k e 32k |
| `PULSE_REASONING_EFFORT` | Override opcional de effort; default `medium`, com `none`/`minimal` coeridos para `low` |

Descobrir IA (publicado em 2026-10-04):

| Variável | Propósito |
|---|---|
| `DISCOVER_RUNNER_TOKEN` | Bearer exclusivo para `POST /api/discover/run-due`; ausente, a rota retorna 503 |
| `DISCOVER_RUNNER_URL` | Override opcional do endpoint local do agendador |

`systemd/chatgpt-discover.timer` agenda a curadoria para 08h em `America/Sao_Paulo`, com `Persistent=true`. A unit instalada usa uma cópia de `scripts/run-discover-due.sh` em `/usr/local/libexec/chatgpt-discover-run-due.sh` e recebe o token de `/etc/chatgpt/discover.env` (root, 0600). O app recebe o mesmo arquivo pelo drop-in `/etc/systemd/system/chatgpt.service.d/30-discover.conf`. O script entrega o token ao curl por stdin. A chamada manual autenticada independe do timer. A execução pode gerar até cinco textos e cinco capas por rodada; sem matéria nova, preserva o feed existente. Sem fonte verificável para a curadoria inicial, registra falha. A build atual veio da cópia isolada `/root/.cache/gaucho-discover-refine-deploy-20261004`, com os ajustes locais de viewport preservados; a origem deve permanecer até a integração da branch. Reescritas únicas usam `scripts/rewrite-discover-current.ts --apply --expected-count N`; o comando reserva o job, só troca o lote completo e cria backup privado em `data/discover-backups/`.

Controle de curadoria (2026-10-07): o timer continua acordando diariamente às 08h; o app decide sob lock se a atualização está habilitada e se transcorreram dois dias civis desde a última tentativa automática. Pausado ou ainda não devido, não chama provedores. O interruptor não executa systemctl nem indica saúde da unit; não exige alteração/reinício do timer. A preferência fica em `data/discover.json`, com leitura compatível de arquivos antigos. Publicação desse comportamento depende da instalação autorizada da nova build.

Publicação de 2026-10-07: build viva `6_32NVLtusWBg1p8kSENn` originada de `/root/.cache/gaucho-discover-controls-20261007` (preservar diretório), backup anterior em `/root/.cache/gaucho-deploy/20261007T161559Z/next-before`. Fontes integrados à main; serviço reiniciado, health local/público 200 e agendadores retomados. Controle de dois dias e TTS das matérias publicados, Studio novamente nos atalhos. Sem alteração de proxy, portas ou dados pessoais. Este registro substitui as referências de build atual anteriores desta seção.

Transcrição:

| Variável | Propósito |
|---|---|
| `TRANSCRIPTION_STREAMING_ENABLED` | `true` por padrão; `false` força resposta final `{ text }` sem NDJSON |

SoundCase:

| Variável | Propósito |
|---|---|
| `SOUNDCASE_DATA_DIR` | Raiz privada de projetos, fila, chunks e assets; default `data/soundcase` |
| `SOUNDCASE_WORKER_TOKEN` | Bearer obrigatório e exclusivo do runner interno |
| `SOUNDCASE_WORKER_URL` | Endpoint loopback do worker; default inclui o base path `/chat` |
| `SOUNDCASE_TTS_CONCURRENCY` | Chamadas TTS simultâneas; default e teto operacional inicial `2` |

As units versionadas `chatgpt-soundcase.service`, `.path` e `.timer` executam o worker durável sem porta nova. A `.path` reage a `data/soundcase/jobs.json`; o timer reabre a fila a cada minuto após falha/reboot. O token entra no `curl` por stdin e não aparece no argv. Instalação no host só deve ocorrer junto do build que já contenha `/chat/api/soundcase/*`.

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
| `data/discover.json` | Assuntos, matérias e estado de atualização do feed Descobrir IA |
| `data/discover-images/` | Capas PNG privadas das matérias do feed |
| `data/discover-backups/` | Backups 0600 anteriores a reescritas controladas do lote |
| `data/soundcase/` | Projetos, drafts, manifestos, chunks, áudio e capas privados do SoundCase |

Auth do app:

| Variável | Propósito |
|---|---|
| `AUTH_ENABLED` | Obrigatoriamente `true` em produção; fora dela, apenas `false` explícito desliga |
| `AUTH_USERNAME` | Usuário aceito pelo login |
| `AUTH_PASSWORD` | Senha aceita pelo login |

`AUTH_USERNAME`, `AUTH_PASSWORD` e `JWT_SECRET` devem estar presentes e não vazios quando auth estiver ligada. Configuração inválida impede inicialização; build não exige credenciais. `/api/health` é readiness sem mutações e responde 503 para falha de auth/storage; `/api/health/live` indica apenas processo respondendo. Health não cria um armazenamento novo nem comprova restauração integral.

Rate limit:

| Variável | Propósito |
|---|---|
| `RATE_LIMIT_ENABLED` | Liga/desliga rate limit |
| `RATE_LIMIT_CHAT_RPM` | Limite específico de chat |
| `RATE_LIMIT_STUDIO_RPM` | Limite específico do assistente contextual do Studio |
| `RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM` | Limite do autocomplete FIM do Studio; default `180` |
| `RATE_LIMIT_STUDIO_WORKSPACE_UNLOCK_RPM` | Limite do unlock do workspace Python; default `10` |
| `RATE_LIMIT_STUDIO_WORKSPACE_RUN_RPM` | Limite do run do workspace Python; default `30` |
| `RATE_LIMIT_STUDIO_WORKSPACE_STDIN_RPM` | Limite do `run/stdin` do console (uma linha por request no `input()`); default `240` |
| `RATE_LIMIT_TRANSCRIBE_RPM` | Limite específico de transcrição |
| `RATE_LIMIT_LOGIN_RPM` | Limite específico de login |

Workspace Python do Studio:

| Variável | Propósito |
|---|---|
| `STUDIO_WORKSPACE_PASSWORD` | Senha do step-up auth; sem ela o modo servidor fica desabilitado (rollback = remover e reiniciar) |
| `STUDIO_RUN_TIMEOUT_MS` | Timeout do run sandboxed; default `120000` |
| `GAUCHO_SERVICE_UNIT` | Unit proprietária a verificar no systemd; default `chatgpt.service`. Não é prova de propriedade por si só |

O host do workspace é provisionado por `scripts/studio-workspace-setup.sh` (idempotente): usuário de sistema `studio` sem shell, `/root/studio-projects/{active,archive}`, venv base em `/opt/studio-venv` com dependências congeladas em `scripts/studio-venv-requirements.txt`, e template inicial versionado em `templates/studio-python/`. Units `gaucho-studio-run-<id>`, `gaucho-studio-term-<id>` e `gaucho-studio-kernel-<id>` mantêm sandbox e limites. Novas units recebem `BindsTo`, `PartOf` e `After` da unit proprietária; unit, invocação e cgroup do processo são conferidos antes de habilitar Studio. Sem proprietário comprovado, configuração que habilita Studio impede boot. QA não habilita o workspace real.

DECISÃO de transição: o boot não executa mais stop/reset-failed por wildcard. Units legadas sem vínculo não são encerradas automaticamente; conferir sessões e combinar eventual limpeza individual no deploy autorizado. Seus limites anteriores continuam como backstop. Nenhuma adaptação para `sonaris.us` integra esta entrega.

## Deploy e Validação

Gates em worktree isolada, nunca no checkout servido por produção:

```bash
cd /caminho/da/worktree-isolada
npx next typegen
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`scripts/pre-deploy.sh` recusa o WorkingDirectory do serviço antes de gates, não remove `.next`, não instala dependências e não lê envs/segredos. `--skip-build` não certifica entrega completa. `scripts/test-local.sh --port <porta>` exige isolamento e porta livre, escuta em loopback, usa QA e não inicia após build falho. Fornecer credenciais sintéticas ao runtime de QA por ambiente.

Publicação depende de autorização própria: instalar a build validada com backup recuperável, atualizar somente a unit necessária e então reiniciar `chatgpt.service`. `npm run deploy` (`scripts/deploy.sh`) automatiza esse fluxo: gates e build isolados (ou `--from <dir>` com build pronta), backup da `.next`, assets antigos retidos, restart, health local/público e rollback automático se o local falhar. Validar readiness local e pública em `/chat/api/health`, além do fluxo afetado. Porta ocupada deve falhar sem matar seu ocupante. O runner Pulse envia token por stdin ao curl, sem Bearer no argv.

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
| Porta 3040 ocupada | Identificar o ocupante com `ss -ltnp`; não sinalizar processo alheio automaticamente |
| API retorna 401 | Verificar `AUTH_ENABLED`, cookie `auth-token` e `/api/auth/check` |
| Áudio/TTS falha | Conferir `/chat/api/tts`, console do browser e política de autoplay |

## Registro de Portas

### Anthropic publicada em 2026-10-15

`ANTHROPIC_API_KEY` foi provisionada em `/etc/chatgpt/anthropic.env` (root, 0600). A primeira origem indicada, `/root/STT/.env`, retornou 401. Anders então indicou `CLAUDE_KEY` no `/root/.bashrc` do servidor antigo (145.223.26.62); somente essa variável foi transferida por SSH e mapeada para `ANTHROPIC_API_KEY`, sem emitir seu valor. STT e servidor antigo não foram alterados. `/root/.bashrc` deste host carrega a fonte protegida; backup privado em `/root/.cache/gaucho-claude-20261015/private-backups/bashrc.before`. Nunca imprimir ou versionar valores.

O drop-in versionado `systemd/chatgpt.service.d/50-anthropic.conf` foi instalado e carregado por `chatgpt.service` após autorização explícita de Anders em 2026-10-15. Shell e serviço consomem a mesma fonte. Nenhuma alteração de proxy/porta foi necessária.

Probe de acesso em 2026-10-15: após a atualização da credencial, Models API retornou HTTP 200 e o ID esperado para ambos os modelos Claude. Nenhum conteúdo pessoal foi enviado. Evidência sanitizada em `/root/.cache/gaucho-claude-20261015/evidence/anthropic-models.json`.

Antes de alocar portas novas, consulte `/etc/apache2/APACHE.md` e use:

```bash
/etc/apache2/check-port.sh 3040
/etc/apache2/check-port.sh --list
/etc/apache2/check-port.sh --reserved
```

## Publicação de 2026-10-10 — Descobrir sobreposto

Com autorização explícita de Anders, `npm run deploy -- --from /root/.cache/gaucho-discover-sidebar-20261010` publicou a build validada `6fdxaKpSv_W__7S18fxZa` (código `a1e078c`, branch `codex/discover-sidebar-20261010`). Preservar essa worktree: a build referencia a origem. Backup em `/root/.cache/gaucho-deploy/20261010T183015Z/next-before`. Na publicação, main fonte ainda não havia recebido a entrega. Anders posteriormente aceitou e fechou a entrega, autorizando integração e push na main, sem nova alteração do runtime.

`chatgpt.service` reiniciado; health local/público HTTP 200 `healthy`; JavaScript e CSS públicos conferidos por SHA-256. Discover/Pulse/SoundCase timers e path SoundCase retomados. Porta 3040, proxy `/chat`, cookies e vhost preservados, sem reload Apache. Registro completo em `docs/plans/2026-10-10-descobrir-sidebar-report.md`.

## Publicação no novo host — 2026-10-11

Domínio de destino `https://sonaris.us/chat`; código base `b8cc7b9` com ajustes locais de provisionamento/domínio. Publicada build `iBusu7Tfp4qfNU5z-P428`, originada de `/root/.cache/chatgpt-equalize-20261011/source` (preservar), backup anterior em `/root/.cache/gaucho-deploy/20261011T220824Z/next-before`. Drop-ins xAI/Discover/host carregados; serviço reiniciado e health local/público healthy 200. Catálogo Grok autenticado real: 28 vozes local/público, cache privado/no-store. Catálogo OpenAI 200; smoke de ownership Studio 5/5. Google OAuth permanece não configurado e desconectado nos dois hosts. Configuração de callback no novo é explícita para sonaris.us.

Units e runner Discover instalados, com token interno configurado (requisição com token inválido retorna 401, em vez do 503 anterior). Após aprovação explícita de Anders, corte concluído em 2026-10-11: antigo como fonte dos dados; backup integral do estado anterior do novo em `/var/backups/chatgpt-equalize-20261011/cutover-20261011T221614Z/new-before`; cópia consistente de `data/`, `/root/studio-projects/` e configuração privada, verificada por checksum dry-run antes de subir o serviço. Novo é o único executor: Pulse/SoundCase/Discover timers e SoundCase path enabled/active; os mesmos agendadores do antigo disabled/inactive. Chat antigo permanece ativo para consulta/retorno, sem desligar o host. Health local/público healthy; 46 conversas, 18 memórias e persona nos dois hosts. Studio habilitado com step-up e kernel real sintético validado dentro da jail. Nenhuma alteração de porta/proxy/cookies ou reload Apache. Registro técnico `/root/.cache/chatgpt-equalize-20261011/RELATORIO.md` e estado atual no BACKLOG.

## Publicação autorizada — 2026-10-15

Anders autorizou publicar e comitar. Fonte original conferida contra baseline, sem divergências. DECISÃO: preservar o WIP anterior na main; aplicar somente o patch desta entrega e importar os commits na branch codex/claude-chat-20261015, sem merge do histórico sintético. Commits de implementação 7e444d2 e documentação 40d44c6.

Drop-in 50-anthropic instalado, daemon-reload e publicação via scripts/deploy.sh --from /root/.cache/gaucho-claude-20261015/source, exit 0. Build s8Q5n0uSF_K2_bQfWeKMa; backup /root/.cache/gaucho-deploy/20261015T110653Z/next-before. Preservar a origem da build. Serviço reiniciado e active; health local/público 200 healthy. Chamadas sintéticas autenticadas na rota pública com Sonnet e Opus: 200, texto e conclusão SSE em ambos, sem tools e sem persistir conversa. Chunk público dos modelos idêntico à build validada. Evidências: deploy.log, published-results.json e public-assets.json no diretório evidence da entrega.

Nenhuma mudança em proxy/porta, nenhum reload Apache ou push. Chave carregada no processo e nunca emitida. APACHE.md atualizado. Gates de código anteriores permanecem válidos: publicação não alterou código; somente registros operacionais foram atualizados.
