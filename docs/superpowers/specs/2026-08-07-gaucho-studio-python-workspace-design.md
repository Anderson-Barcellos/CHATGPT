# Gaucho Studio Python Workspace Design

**Status:** desenho consolidado em discussão com Anders (2026-08-07); aguarda revisão final dele antes do plano de implementação
**Data:** 2026-08-07
**Escopo:** workspace Python contínuo em disco no servidor, execução sandboxed com rede liberada e ciclo de vida por zip no Gaucho Studio

## Objetivo

Evoluir o Studio de playground TS/JS browser-only para uma superfície de
trabalho Python real. O padrão de uso de Anders é pequeno projeto com módulos:
agentes, chamadas de API, funções que modificam arquivos e criam logs. Isso
exige filesystem real, rede de saída e chave de API server-side — três coisas
que o runner browser v1 bloqueia por design.

O workspace Python é um subsistema novo e independente. Chat lateral, runner
JS local, autocomplete e autosave do modo local permanecem intocados.

## Decisões aprovadas

- Workspace **único e contínuo** em `/root/studio-projects/active/`, com path
  fixo hardcoded no servidor. O cliente só envia paths relativos; não existe
  criação dinâmica de projetos nem seleção de pasta pelo browser.
- "Salvar" zipa o workspace ativo, grava `archive/<nome>.zip` no servidor e
  entrega o mesmo zip como download para Anders.
- Restaurar (unzip de um item do archive por cima do ativo, com confirmação),
  importar (upload de zip) e resetar (template inicial Python) completam o
  ciclo de vida.
- Execução server-side do arquivo ativo via unit transient do systemd, como
  usuário dedicado sem privilégio, FS confinado ao workspace e **rede
  liberada** — chamadas de API são o caso de uso central.
- Env do run contém somente `OPENAI_API_KEY` (allowlist cresce apenas por
  decisão explícita de Anders) e o venv base no `PATH`.
- Venv base compartilhado gerenciado fora do Studio na v1 (openai, httpx,
  rich, python-dotenv e afins).
- Step-up auth: senha própria do workspace, separada da senha do app,
  trocada por token curto que vive só em memória da aba. Todas as rotas do
  workspace servidor exigem o token, além da autenticação normal do app.
- FIM autocomplete estendido a `"python"` (mesmo contrato DeepSeek do v1).
- Console reusa o painel existente, com stream SSE em tempo real, Stop e
  associação ao arquivo executado.

## Arquitetura

### Modos do Studio

O Studio ganha alternância explícita entre dois contextos independentes:

- **Local (browser)**: o v1 atual, TS/JS em `localStorage`, intocado.
- **Python (servidor)**: árvore carregada da API de arquivos, edição com
  autosave para o disco do servidor, execução server-side.

DECISÃO: alternância por controle no topo do shell, preservando estado de
cada modo ao trocar. REVISÃO SUGERIDA: Anders valida a posição do controle
no primeiro QA visual.

### API de arquivos

Rotas autenticadas + step-up sob `/api/studio/workspace/`:

- `GET /tree` — árvore de arquivos do ativo (paths relativos, tamanhos).
- `GET /file?path=` — conteúdo de um arquivo de texto.
- `PUT /file` — cria/atualiza arquivo (autosave com debounce no cliente).
- `DELETE /file?path=` — remove arquivo.
- `POST /rename` — renomeia/move dentro do ativo.

Todo path relativo é canonicalizado e validado contra a raiz do ativo antes
de qualquer operação; `..`, path absoluto, symlink apontando para fora e
nomes de arquivo fora de uma allowlist de caracteres são rejeitados.
Arquivos binários aparecem na árvore mas não abrem no editor na v1.

### Execução

- `POST /api/studio/workspace/run` — body `{ filePath }`; resposta é stream
  SSE com eventos de console (`stdout`, `stderr`, nível), evento terminal de
  status (`completed | failed | timeout | aborted`) e duração.
- `POST /api/studio/workspace/stop` — encerra a unit transient em execução.
- Um run por vez; iniciar um novo enquanto outro roda é rejeitado com erro
  claro.

O servidor executa:

```
systemd-run --unit=gaucho-studio-run-<id> --scope-like transient service
  User=studio
  BindPaths=/root/studio-projects/active:/workspace
  WorkingDirectory=/workspace
  ProtectSystem=strict  ProtectHome=true  PrivateTmp=true
  NoNewPrivileges=true  MemoryMax=1G  CPUQuota=100%  TasksMax=64
  RuntimeMaxSec como backstop do timeout da rota
  ExecStart=<venv>/bin/python /workspace/<filePath>
```

O processo enxerga o workspace como `/workspace`, o que evita afrouxar as
permissões de `/root`. O Next (root) lê e escreve os arquivos diretamente;
somente o Python roda como `studio`. `stdout`/`stderr` são lidos em streaming
e repassados ao SSE com orçamento de saída próprio (mais generoso que o
runner JS: logs de agente são verbosos) e truncamento explícito quando
estourar. Timeout default de 120 s (`STUDIO_RUN_TIMEOUT_MS`), com Stop
sempre disponível. Ao terminar o run, o cliente recarrega a árvore para
mostrar logs e arquivos criados pelo script.

Pré-requisito de infra (documentar em `docs/INFRASTRUCTURE.md` na
implementação): usuário `studio` sem shell de login, pastas
`/root/studio-projects/{active,archive}` com dono adequado e venv base
provisionado.

### Ciclo de vida por zip

- `POST /save` — body `{ name }`; zipa o ativo (excluindo `__pycache__`,
  `.venv` e artefatos equivalentes), grava `archive/<slug>.zip` e retorna o
  zip como download.
- `GET /archive` — lista os zips salvos (nome, data, tamanho).
- `POST /restore` — body `{ slug }`; substitui o ativo pelo conteúdo do zip,
  após confirmação explícita na UI.
- `POST /import` — upload multipart de zip; mesma semântica do restore.
- `POST /reset` — substitui o ativo pelo template inicial Python.

Extração com proteção zip-slip (todo entry canonicalizado dentro do ativo),
limite de tamanho do upload e do conteúdo extraído, limite de entries e
rejeição de symlinks. Slugs de archive sanitizados para nome de arquivo
seguro. Restore/import/reset primeiro montam em diretório temporário e só
então trocam o ativo, para falha no meio não deixar workspace pela metade.

### Step-up auth

- `POST /api/studio/workspace/unlock` — body `{ password }`; compara com
  `STUDIO_WORKSPACE_PASSWORD` (env, nunca no cliente) em tempo constante e
  retorna token HMAC com validade de 60 min.
- O token vive apenas em memória da aba (nunca `localStorage`) e é enviado
  em header próprio em todas as rotas do workspace.
- Token expirado retorna `401` específico; a UI reabre o prompt de senha e
  repete a ação pendente.
- Rate limit próprio no unlock para conter força bruta.

Modelo de ameaça explícito: o step-up protege contra cookie de sessão vazado
virar execução de código ou escrita de arquivo no host. Ele não protege
contra XSS completo dentro do app — essa ponta pertence à sandbox systemd.

### Autocomplete Python

`"python"` entra em `StudioFileLanguage`, na elegibilidade do provider e no
parser da rota `/api/studio/autocomplete`. Nenhuma outra mudança no contrato
FIM: mesmo modelo, janela, debounce, cooldown e restrição a desktop.

## Contrato de dados

```ts
type StudioWorkspaceRunStatus = "completed" | "failed" | "timeout" | "aborted";

interface StudioWorkspaceTreeEntry {
  path: string;          // relativo à raiz do ativo
  name: string;
  kind: "file" | "directory";
  size: number;
  editable: boolean;     // texto dentro do limite de tamanho
}

interface StudioWorkspaceRunEvent {
  type: "console" | "status";
  level?: "log" | "error";      // console: stdout=log, stderr=error
  text?: string;
  status?: StudioWorkspaceRunStatus;
  durationMs?: number;
}

interface StudioArchiveEntry {
  slug: string;
  savedAt: string;
  sizeBytes: number;
}
```

Limites server-side: arquivo editável até 1 MB; upload de zip até 50 MB;
conteúdo extraído até 200 MB e 2 000 entries; path relativo até 320
caracteres.

## Fluxo de interação

1. Anders alterna para o modo Python; a árvore carrega do servidor.
2. Na primeira ação da sessão, a UI pede a senha do workspace e guarda o
   token em memória.
3. Edição salva com debounce via `PUT /file`; o indicador "Salvo" existente
   reflete o estado do disco.
4. Run executa o arquivo ativo; console recebe stdout/stderr em tempo real;
   Stop ou timeout encerram a unit.
5. Ao fim do run, a árvore recarrega mostrando logs e arquivos gerados.
6. "Salvar projeto" pede um nome, baixa o zip e registra no archive;
   "Novo projeto" reseta o template após confirmação; restaurar e importar
   substituem o ativo com confirmação.

## Erros e contenção

- Falha de rede/timeout do SSE marca o run como `failed` com o conteúdo
  parcial preservado no console.
- Runs órfãos são contidos pelo `RuntimeMaxSec` da própria unit, mesmo se o
  Next reiniciar no meio.
- Orçamento de saída do console com truncamento explícito e aviso.
- Rate limit próprio nas rotas de run e unlock.
- Nenhum log do servidor registra código, senha, token ou conteúdo de
  arquivo.

## Limites conscientes da v1

- Sem stdin interativo: script com `input()` falha com erro claro no
  console. REPL/terminal interativo é expansão futura.
- Sem instalação de pacotes pelo Studio; o venv base é gerenciado por Anders
  fora da UI.
- Um workspace ativo e um run por vez; sem execução concorrente.
- Sem language service Python (Pyright); highlight nativo do Monaco + FIM.
- Sem editor de binários e sem preview de imagem na v1 (arquivos gerados
  aparecem na árvore e saem no zip).
- Chat lateral segue somente leitura; nada de modo agente ou patch
  automático.
- Runner JS local v1 permanece como está, sem fusão de contratos.

## Estratégia de testes

### Unitários

- Canonicalização de paths rejeita `..`, absoluto, symlink e nomes fora da
  allowlist; aceita subdiretórios legítimos.
- Extração de zip bloqueia zip-slip, symlink, excesso de entries/tamanho.
- Sanitização de slug do archive.
- Parser dos eventos SSE e orçamento de saída com truncamento.
- Token de step-up: emissão, validação, expiração, comparação em tempo
  constante.

### Servidor

- Todas as rotas exigem auth do app + token de step-up; token expirado
  retorna o `401` específico.
- Run monta a unit transient com as propriedades de sandbox esperadas
  (spawn mockado), respeita timeout e um-run-por-vez; stop encerra a unit.
- Save/restore/import/reset respeitam limites e a troca atômica via
  diretório temporário.
- Env do run contém somente as variáveis da allowlist.

### Integração

- Smoke autenticado real: script que imprime, escreve log e chama API
  externa; SSE entrega em tempo real; árvore recarrega com o log criado.
- Stop interrompe um script em loop; timeout encerra e reporta.
- Roundtrip save → reset → restore preserva o conteúdo byte a byte.
- Autocomplete produz ghost text em arquivo `.py` no desktop.

### Validação final

- Suíte completa, TypeScript, ESLint e build Next.
- `git diff --check` e `npm audit --omit=dev`.
- Restart de `chatgpt.service`, health local/público.
- Smoke Chrome autenticado no modo Python cobrindo o fluxo completo.
- Verificação viva da sandbox: dentro do run, tentativa de escrita fora de
  `/workspace` falha e a rede externa funciona.

## Critérios de aceite

- Um projeto Python multi-arquivo com imports locais roda pelo botão Run,
  com stdout/stderr em tempo real no console e Stop funcional.
- Um script consegue chamar a API da OpenAI usando a chave do env e gravar
  log em arquivo que aparece na árvore após o run.
- Escrita fora do workspace e escalação de privilégio falham dentro do run.
- Salvar entrega o zip no browser e no archive; restaurar e importar
  reconstroem o ativo fielmente; reset volta ao template.
- Nenhuma rota do workspace responde sem cookie válido + token de step-up.
- A senha do workspace, o token e a chave OpenAI nunca aparecem no cliente
  além do necessário, nem em logs, diffs ou respostas de erro.
- Chat, runner JS local, autocomplete TS/JS e o restante do app permanecem
  com comportamento idêntico ao atual.
