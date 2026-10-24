# Ditado ao vivo no Gaúcho — 23/10/2026

Implementação direta autorizada por Anders, conduzida pelo Codex sozinho. Fonte isolada: `/root/worktrees/gaucho-ditado-realtime`, base `c59ea2d` acrescida do WIP de código/documentação do checkout vivo. Baseline para revisão incremental e evidências: `/root/.cache/gaucho-ditado-realtime/`. Dados pessoais, configurações privadas e `.continue` não foram copiados. Preparação inicialmente sem commit, push, restart ou publicação; a atualização autorizada está registrada ao final.

DECISÃO: reaproveitar protocolo, reconciliador e worklet do STT já validado, com ponte própria autenticada pelo cookie do Gaúcho. Evita mudar o servidor Next ou compartilhar o login do STT. Contexto de transcrição é geral em português; não força vocabulário médico em mensagens pessoais.

DECISÃO: guardar áudio em memória desde o início, inclusive antes de a conexão ficar pronta. Falha do Realtime usa a gravação inteira no endpoint HTTP existente; a prévia é substituída, não concatenada. Resultado incompleto não vira nota. Chat fica somente leitura durante captura para que um delta não sobrescreva uma edição concorrente; ao parar, volta a ser editável e não envia automaticamente.

DECISÃO: preservar o WIP como baseline para implementação, sem apresentá-lo como equivalente à release publicada. A candidata foi reconciliada com os seis arquivos DeepSeek `max` da fonte da release atual (`/root/.cache/gaucho-press-20261021/source`), preservando no checkout vivo o WIP `low`. Apenas a descrição do composer participa do mesmo arquivo da mudança: na promoção do código, aplicar o diff funcional sobre o baseline, mantendo a descrição `low` do WIP; a build candidata preserva `max` publicado. Não promover os outros cinco arquivos de conciliação para o checkout. Instalação/publicação requer autorização específica.

DECISÃO: tornar `ws` dependência direta usando a versão 8.21.1 já resolvida no lockfile original; `@types/ws` 8.18.1 foi acrescentado para a ponte. Sem atualização geral de dependências. Falha de persistência de nota conserva o texto visível com ação de copiar, sem repetir POST de resultado incerto.

Publicada com autorização de Anders em 23/10/2026. Build candidata `BDr0Qzt70HLiGVp34_yrF`. A build anterior `VpqUQkfWDgyJNn4Tx8i-w` foi guardada para reversão; WIP preservado.

## Evidência final

Todos os logs abaixo ficam em `/root/.cache/gaucho-ditado-realtime/`.

| Comando/fluxo | Resultado | Evidência |
| --- | --- | --- |
| `npm test` | exit 0; 221 arquivos, 1.193 testes, zero falhas/skips | `tests-release.log` |
| `NEXT_PUBLIC_BASE_PATH=/chat npx --no-install next typegen` | exit 0 antes do typecheck isolado | `typegen.log` |
| `npx --no-install tsc --noEmit` | exit 0 | `types-release.log`, `release-gates.json` |
| `npm run lint` | exit 0; zero erros, um warning no teste anterior do composer (arquivo idêntico ao baseline) | `lint-release.log` |
| `npm run build` | exit 0; 43 páginas, três warnings nas categorias anteriores de instrumentação Edge e tracing amplo do Studio | `build-release.log`, `release-gates.json` |
| `node qa.mjs` | exit 0; oito cenários desktop 1440×1000 e mobile 390×844 | `browser-final.log`, `browser-results.json`, `*-recording-*.png` |
| `systemd-analyze verify systemd/chatgpt-transcription.service` | exit 0 | `systemd-verify.log` |
| `bash -n deploy/install.sh`, `git diff --check` | exit 0 | verificação final |
| Launcher real com configuração sintética, porta isolada 3143 | HTTP 200 em `/health`, bind loopback, SIGTERM exit 0 | `launcher.log` |

No navegador foram exercitados AudioWorklet real, MediaRecorder real sobre áudio sintético, WebSocket com cookie de login Next, ponte real e provedor local simulado: prévia durante gravação, rascunho preservado, zero requisições de envio do chat, microfone liberado ao parar, fallback após falha upstream, nota única sem escrita durante deltas, falha de persistência sem retry automático e texto conservado para copiar. Sem erros JavaScript na rodada final; sem overflow horizontal. Capturas inspecionadas. Provedor OpenAI real, voz de Anders e Safari/iPhone físico não foram exercitados.

Primeira tentativa de browser atingiu a inicialização concorrente de `conversations.json` no diretório sintético vazio. O harness passou a preparar o arquivo pela API antes de abrir a interface; não houve alteração no armazenamento do produto. O lint inicial apontou atribuição no render do harness novo, corrigida para efeito; o primeiro typecheck apontou assinaturas genéricas de mocks, corrigidas. Logs das tentativas preservados. As últimas suítes repetidas se justificam pela conciliação com a release e pela proteção adicional de falha ao salvar.

Os warnings de build foram comparados com `/root/.cache/gaucho-press-20261021/evidence/build.log`: mesmas categorias e cadeia `studioWorkspaceFs → next.config/instrumentation`, com uma ocorrência adicional do aviso de tracing no asset de instrumentação. Os três arquivos da cadeia são idênticos à fonte publicada; não se afirma igualdade na contagem dos avisos (dois na referência, três aqui). Build concluído com exit 0.

Ambiente de QA encerrado. Notas sintéticas foram removidas pela API na mesma rodada; nenhuma conversa ou nota do checkout vivo foi acessada. Baseline e candidata devem ser mantidos até publicação/revisão. Sem servidor novo instalado, sem alteração de Apache nem chamadas pagas.

## Arquivos da mudança

- Hook e superfícies: `hooks/useSpeechToText.ts`, `CommandComposerContainerV2.tsx`, `WorkspaceLayoutV2.tsx`, `WorkspaceCapturesPanelV2.tsx` e testes comportamentais.
- Áudio/protocolo: `lib/transcription/realtime.ts`, `realtimeClient.ts`, `public/pcm-recorder.js` e testes; reconciliador/worklet transplantados do STT.
- Ponte: `lib/server/realtimeTranscription.ts`, `scripts/transcription-server.ts`, `systemd/chatgpt-transcription.service`, `deploy/apache-chat.conf`, `deploy/install.sh`, manifestos npm e testes.
- Contratos: API, arquitetura, modelos, infraestrutura, BACKLOG, diário e este registro. O fallback HTTP existente permanece consumidor real do áudio integral; funções de TTS não foram substituídas.

Na publicação: reconferir drift do checkout e a porta 3041, preservar os WIPs segundo a decisão acima, instalar apenas a unit/dependências/snippet necessários, validar Apache antes do reload, promover esta build e reiniciar somente os serviços afetados. Atualizar `/etc/apache2/APACHE.md` e confirmar health local/público, cookie/origem, fluxo real e fallback. Esta preparação não autoriza essas ações.

Referência de protocolo conferida: https://developers.openai.com/api/docs/guides/realtime-transcription . Sem chamadas pagas ou áudio pessoal nesta preparação.


## Publicação autorizada — 23/10/2026

Anders autorizou: “Opa meu velho! podemos sim! Vamos atualizar deploy”. Conferência anterior: zero drift em relação ao baseline, patch funcional aplicável, porta 3041 livre e fonte/build validada preservada. Backup de código e Apache: `/root/backups/gaucho-ditado-20261023T213014Z/`; backup automático da build: `/root/.cache/gaucho-deploy/20261023T213033Z/next-before`.

Aplicados os 28 arquivos do patch funcional, preservando os WIPs e DeepSeek low no código vivo; build publicada mantém max como antes. `ws` 8.21.1 e `tsx` 4.23.13 já estavam instalados; somente o pacote de tipos validado foi acrescentado. `chatgpt-transcription.service` instalado e enabled/active, zero reinícios inesperados; bind 127.0.0.1:3041, configuração privada existente reutilizada sem cópia de segredo. Snippet específico instalado; `apache2ctl configtest` exit 0 antes de reload. `scripts/deploy.sh --from /root/worktrees/gaucho-ditado-realtime` exit 0, build BDr0Qzt70HLiGVp34_yrF e restart apenas do chat. Agendadores permaneceram ativos; nenhuma outra aplicação reiniciada.

Validação publicada: saúde local/pública healthy HTTP 200; ponte ready 200; WebSocket público anônimo 401 e origem incorreta 403. Áudio de voz sintética gerado localmente pelo FFmpeg/flite passou pelo provedor OpenAI real: 19 eventos textuais e texto antes de stop, finalização completa do protocolo; fallback HTTP NDJSON com done/200. O teste comprova transporte e finalização, não equivalência de acurácia entre os modelos.

Chrome público 1440×1000 e 390×844: áudio sintético, cookie temporário de cinco minutos assinado em memória, OpenAI real, rascunho preservado, prévia ao vivo, edição liberada ao parar e zero envio automático. Notas desktop: zero POST durante os deltas e um POST final. APIs de dados interceptadas com fixtures no navegador, sem leitura/escrita de conversas/notas privadas. Sem erros JavaScript; capturas inspecionadas. 23 assets JS/CSS e o worklet públicos iguais byte a byte à versão instalada. Microfone real de Anders e Safari/iPhone físico seguem sem validação.

Evidências (todos os comandos exit 0): `deploy.log`, `verify-deploy.log`, `published-verification.json`, `public-browser.log`, `public-browser-results.json`, `public-assets.json` e `published-*.png` em `/root/.cache/gaucho-ditado-realtime/`. `/etc/apache2/APACHE.md` atualizado. Sem commit/push. Manter worktree/build e backups para reversão; a build anterior pode ser restaurada pelo procedimento no log de deploy.
