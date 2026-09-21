# Relatório — Gaucho Chat Desktop standalone para Windows

## Fundação Electron e prova de empacotamento

**DECISÃO (CI em checkout limpo):** o gate TypeScript do PR executa
`next typegen` antes de `tsc --noEmit`. O GitHub não possui o
`next-env.d.ts` ignorado pelo repositório, enquanto as validações locais já o
tinham gerado; usar o gerador oficial preserva o ignore atual e torna o gate
reproduzível sem alterar Studio ou código de produto.

**Resultado observável:** existe agora um target Electron isolado. Ele inicia o
Next standalone somente em `127.0.0.1` numa porta efêmera, instala um token
aleatório por execução como cookie HttpOnly, não expõe Node ao renderer, mantém
a janela na tray ao fechar e encerra backend/Electron somente por `Sair`.
Studio, SoundCase e Calendar/Google retornam 404 apenas na edição desktop; o
web mantém `/chat`, seu `basePath` e o comportamento anterior.

**Arquivos tocados:** `.gitignore`, `eslint.config.mjs`, `next.config.ts`,
`package.json`, `package-lock.json`, `proxy.ts`, `lib/runtime/edition.ts`,
`lib/runtime/edition.test.ts`, `lib/server/jsonFileStore.ts`,
`lib/server/memory/indexStore.ts`, `lib/server/memory-v2/database.ts`,
`desktop/forge.config.ts`, `desktop/main.ts`, `desktop/preload.ts`,
`desktop/lifecycle.ts`, `desktop/runtime.ts`, seus testes e configs Vite,
`desktop/scripts/build-next.mjs` e `.github/workflows/desktop-windows.yml`.

**DECISÃO:** o Next standalone inteiro entra como `extraResource` em
`resources/.next`, fora de `app.asar`; assim `better-sqlite3` e
`@lancedb/lancedb` podem carregar seus binários no processo Node do Electron.
`electron-rebuild --force --only better-sqlite3,@lancedb/lancedb` roda antes
da build Next e o Forge repete a reconstrução no pacote. O preload expõe só
`gauchoDesktop: { edition, isDesktop }`; não existe IPC, chave, token ou acesso
Node no renderer.

**DECISÃO:** `GAUCHO_DATA_DIR`, entregue pela main process com
`app.getPath("userData")`, é obrigatório no desktop e substitui somente os
paths compartilhados de JSON, LanceDB e SQLite V2; na web o fallback preserva
`process.cwd()/data`. O tracing standalone exclui `.env*` e `data/**` para que
o alcance dinâmico conhecido do Studio nunca inclua segredos ou runtime no
artefato desktop.

**DECISÃO:** não foram usados Electron Fuses que desligam `RunAsNode`, pois o
backend standalone é iniciado com `ELECTRON_RUN_AS_NODE=1`. A contenção desta
fundação é feita por janela sandboxed (`nodeIntegration=false`,
`contextIsolation=true`, `sandbox=true`), loopback estrito, token HttpOnly e
navegação externa HTTP(S) delegada ao navegador padrão.

**Substituições e remoções:** nenhuma rota, componente ou import web foi
removido. `proxy.ts` preserva autenticação, rate limit e CSP existentes; a
barreira desktop foi inserida antes desses fluxos. Os gerados `.vite/` e
`desktop/.next/` foram apenas ignorados e não entram no Git.

### Gates

| Comando | Resultado |
| --- | --- |
| `npm test -- desktop lib/runtime/edition.test.ts lib/server/jsonFileStore.test.ts proxy.test.ts` | OK — exit 0; 6 arquivos, 22 testes. |
| `npm test` | OK — exit 0; 176 arquivos, 871 testes. |
| `npx tsc --noEmit` | OK — exit 0. |
| `npm run lint` | OK — exit 0; 0 erros, 1 warning preexistente de `_content` em `CommandComposerContainerV2.test.tsx`. |
| `git diff --check` | OK — exit 0. |
| `npm run desktop:build-next` | OK — exit 0; standalone com 41 rotas. Warning conhecido de NFT do Studio, sem falha. |
| `npm run desktop:package` | OK — exit 0; Vite gerou main/preload, Forge criou pacote Linux x64 e reconstruiu 2/2 módulos nativos. A primeira tentativa falhou por Forge não localizar sua config em `desktop/`; corrigido com `package.json#config.forge` e a repetição passou. |

**BLOCKED — evidência Windows real:** o workflow Windows x64 está configurado
em `.github/workflows/desktop-windows.yml` para `npm ci` e
`npm run desktop:make:win`, mas não há runner remoto nesta rodada. Portanto não
há alegação de instalador, DPAPI, tray, segunda instância ou restart validados
em Windows; esses itens dependem da execução do workflow/runner Windows. A
prova local confirma somente o pacote Linux, o layout de recursos e a
reconstrução local dos módulos nativos.

### Ajustes da revisão independente

**Arquivos tocados nesta rodada:** `desktop/main.ts`, `desktop/runtime.ts`,
`desktop/runtime.test.ts`, `lib/runtime/edition.ts`,
`lib/runtime/edition.test.ts`, `proxy.ts`, `proxy.test.ts`,
`vitest.config.ts` e `.github/workflows/desktop-windows.yml`.

**DECISÃO:** o processo filho não herda mais `process.env`. A função testável
`buildDesktopChildEnvironment` permite apenas variáveis operacionais do sistema
(paths, locale, diretórios de usuário, display e equivalentes Windows), soma as
variáveis desktop explícitas e fixa `AUTH_ENABLED=false`. O teste usa um
ambiente sintético com chaves de OpenAI, DeepSeek, Gemini, Google, JWT, auth,
Pulse, SoundCase, Studio e token genérico, comprovando que nenhuma delas chega
ao backend.

**DECISÃO:** o polling de inicialização aceita `200` ou exclusivamente o `503`
do contrato atual de health para ausência de provider (`status="unhealthy"`,
`checks.openai.status="error"` e mensagem `OpenAI API key not configured`).
Todo `500` e qualquer outro `503` continua aguardando e termina por timeout.

**DECISÃO:** `proxy.ts` voltou à formatação-base; ficaram somente a barreira
desktop, a CSP contextual e os imports necessários. A comparação do token usa
`crypto.subtle.digest` e percorre os dois hashes SHA-256 por inteiro; é Web
Crypto disponível no runtime do proxy, sem importar API Node incompatível.
Na edição desktop a CSP remove apenas `upgrade-insecure-requests`, preservando
os assets HTTP de loopback; a CSP web mantém essa diretiva, coberta por teste.

**DECISÃO:** o workflow Windows agora confere a presença simultânea de `.exe` e
`.zip`, publica ambos via `actions/upload-artifact@v4` e observa todos os
arquivos compartilhados desta fundação. `vitest.config.ts` ignora cópias de
testes geradas por `.next/standalone`, `desktop/.next` e `out`, para que a
validação rode somente a árvore-fonte após o empacotamento.

**Substituições e remoções:** nenhuma. A conferência do diff mostra que a
formatação prévia de `proxy.ts` foi restaurada; nenhum import web foi retirado.

### Gates da revisão

| Comando | Resultado |
| --- | --- |
| `npm test -- desktop lib/runtime/edition.test.ts proxy.test.ts` | OK — exit 0; 5 arquivos, 21 testes. |
| `npm test` | OK — exit 0; 176 arquivos, 874 testes. |
| `npx tsc --noEmit` | OK — exit 0. |
| `npm run lint` | OK — exit 0; 0 erros, 1 warning preexistente de `_content` em `CommandComposerContainerV2.test.tsx`. |
| `git diff --check` | OK — exit 0. |
| `npm run desktop:package` | OK — exit 0; Next standalone com 41 rotas, Vite main/preload e pacote Linux x64. Permanece o warning conhecido de NFT do Studio, sem falha. |
| Smoke Linux sem credenciais: `xvfb-run` como usuário sem privilégios sobre cópia temporária do pacote | BLOCKED — exit 1; o Chromium abortou antes da janela/backend porque `chrome-sandbox` do pacote está `root:root 755`, sem o setuid `4755` exigido. A primeira tentativa havia falhado por falta de travessia de `/root`; a repetição autorizada isolou a cópia em `/tmp` e revelou o bloqueio real. Não foi usado `--no-sandbox`, não houve chave/provider, asset ou backend iniciado e não restaram processos do app. |

**BLOCKED — smoke Linux e evidência Windows:** validar o lançamento sob sandbox
Linux exige instalar/alterar metadados privilegiados de `chrome-sandbox`, ação
fora deste grupamento. A evidência Windows continua dependente do runner
`windows-2022`; o workflow agora retém instalador e ZIP para a checagem real.

### Revisão final da fundação

**Arquivos tocados nesta rodada:** `instrumentation.ts`,
`instrumentation.test.ts`, `desktop/main.ts`, `desktop/lifecycle.ts`,
`desktop/lifecycle.test.ts`, `desktop/forge.config.ts`,
`desktop/forge.config.test.ts` e `package.json`.

**DECISÃO:** a instrumentation verifica `GAUCHO_EDITION=desktop` antes do
import dinâmico de `studioOrphanUnits`; portanto a edição desktop não carrega
nem executa `stopOrphanedStudioUnits()` e nunca tenta `systemctl`. Na web Node,
o carregamento e a chamada permanecem idênticos ao comportamento anterior; o
teste cobre os dois ramos com loader injetável.

**DECISÃO:** falhas de `startBackend` ou `createWindow`, bem como a saída
inesperada do backend após subir, convergem para um encerramento idempotente:
param o filho, destroem a janela, mostram somente a mensagem genérica
“Não foi possível iniciar o Gaucho Chat. Tente abrir o aplicativo novamente.”
e chamam `app.quit()`. A mensagem deliberadamente não inclui path, comando,
token ou detalhe de ambiente; o teste de lifecycle prova que o caminho ocorre
uma única vez.

**DECISÃO:** a identidade de distribuição passa a ser `productName: "Gaucho
Chat"` e `packagerConfig.executableName: "Gaucho Chat"`. O Maker Squirrel usa
esse nome do produto para o instalador; não foi incluído ícone nesta fundação.
O teste de configuração prova os dois valores. O pacote pesado não foi repetido
porque a alteração é declarativa e a configuração é exercitada pelo teste; a
prova real de artefato Windows continua no workflow.

**Substituições e remoções:** nenhuma. Studio continua presente na web; apenas
a limpeza de unidades órfãs deixa de ser importada pela edição desktop.

### Gates da revisão final

| Comando | Resultado |
| --- | --- |
| `npm test -- instrumentation.test.ts desktop/lifecycle.test.ts desktop/runtime.test.ts desktop/forge.config.test.ts lib/runtime/edition.test.ts proxy.test.ts` | OK — exit 0; 6 arquivos, 24 testes. |
| `npm test` | OK — exit 0; 177 arquivos, 877 testes. |
| `npx tsc --noEmit` | OK — exit 0. |
| `npm run lint` | OK — exit 0; 0 erros, 1 warning preexistente de `_content` em `CommandComposerContainerV2.test.tsx`. |
| `git diff --check` | OK — exit 0. |
| `npm run desktop:package` | Não repetido nesta rodada: a mudança de identidade foi verificada no teste de configuração, sem alterar o pipeline, binários nativos ou recursos; a evidência do pacote Linux anterior permanece registrada acima. |
