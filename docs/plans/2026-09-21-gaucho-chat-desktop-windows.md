# Gaucho Chat Desktop standalone para Windows

**Estado:** ativa  
**Aprovada por Anders:** 2026-09-21  
**Relatório:** `docs/plans/2026-09-21-gaucho-chat-desktop-windows-report.md`

## 1. Entrevista e decisões vinculantes

### 1.1 Aprovação

Anders aprovou integralmente esta entrega e autorizou sua execução. Também autorizou reutilizar a `OPENAI_API_KEY` já existente apenas em memória durante testes que realmente precisem da API. A chave não será lida de arquivos de shell, copiada, registrada, commitada nem incluída em fixtures ou artefatos.

### 1.2 Entendimento do pedido

Transformar o Gaucho Chat num aplicativo Electron standalone para Windows, compartilhando o núcleo com a versão web, mas sem depender de `ultrassom.ai`. O desktop inclui Chat, histórico, anexos, artefatos, exportação, Persona, configurações, memória, Notas, Pulse/Rotinas, imagem, transcrição e áudio. Studio, SoundCase e Google Calendar legado ficam fora.

Exemplos observáveis:

- Quando Anders instalar o aplicativo, consegue configurar sua chave OpenAI e usar o Chat sem Node, npm, Apache ou servidor externo.
- Quando Pesquisa Medium ou High estiver ativa, o modelo escolhido no composer é o modelo realmente enviado; não há substituição oculta.
- Quando Anders disser “lembra disso”, o fato entra com evidência e ação de desfazer; inferências viram sugestões revisáveis.
- Quando fechar a janela, o app continua na bandeja e executa Pulse; “Sair” encerra tudo.
- Quando importar o pacote do servidor, conversas, persona, memória, notas, Pulse e avatares reaparecem; chaves e índices derivados não entram no pacote.

### 1.3 Decisões confirmadas

| Tema | Decisão |
|---|---|
| Standalone | UI, API local, dados, memória e scheduler vivem no Windows; somente a OpenAI é externa |
| Código | Mesmo núcleo do web, com target desktop isolado |
| Pesquisa | O modelo selecionado manda; profundidade altera instruções/tools, não o model ID |
| Catálogo | Curado pelo app e cruzado com disponibilidade da conta via `/v1/models` |
| Dados | Importação/exportação versionada, sem sincronização contínua |
| Proteção | Perfil privado do Windows; chave cifrada com DPAPI; backup pode receber senha |
| Memória | Fatos versionados e auditáveis + recuperação semântica do histórico |
| Escrita de memória | Pedido explícito aplica com desfazer; inferência aguarda aprovação |
| Pulse | Continua na system tray; iniciar com Windows é configurável e desligado por padrão |
| Avatares | Usuário e assistente configuráveis; cerca de 32 px no mobile e 36 px no desktop |
| Distribuição | Instalador Windows x64, atualização manual; assinatura/auto-update ficam para depois |

## 2. Objetivo

Entregar um instalador Windows x64 do Gaucho Chat que funcione de forma local e independente, preserve o produto web e permita chave própria, modelos OpenAI, pesquisa com modelo escolhido, identidade visual, memória V2 e Pulse em segundo plano.

## 3. Fica fora

- Studio, SoundCase, Google Calendar/OAuth e suas rotas no desktop.
- macOS, Linux, Windows ARM, Microsoft Store, auto-update e assinatura obrigatória.
- Sincronização contínua com o servidor, contas multiusuário e colaboração.
- Deploy, restart ou alteração do checkout que serve produção.
- Inclusão da chave OpenAI, índices vetoriais derivados ou dados de Studio/SoundCase no backup.

## 4. Contratos compartilhados

- Introduzir `GauchoEdition = "web" | "desktop"`; o web conserva `/chat`, DeepSeek, Gemini, Studio, SoundCase, Apache e systemd.
- O desktop usa Electron com `nodeIntegration: false`, `contextIsolation: true`, sandbox e preload mínimo tipado.
- O processo principal inicia o backend Next standalone em `127.0.0.1` numa porta efêmera e protege as rotas com token aleatório por execução instalado como cookie HttpOnly.
- A chave é cifrada no processo principal com `safeStorage`/DPAPI. O renderer recebe somente estado, últimos quatro caracteres e resultado da validação.
- Dados desktop vivem sob `app.getPath("userData")`; nenhum caminho desktop depende de `process.cwd()/data`.
- `BackupManifestV1` inclui versão, app, data, contagens e hashes. Restauração V1 aceita perfil vazio ou substituição explícita após backup automático; não faz merge heurístico.
- `GET /v1/models` valida disponibilidade, enquanto capacidades, limites e compatibilidade permanecem em catálogo curado.
- A edição desktop usa `web_search` nas novas chamadas. O web mantém compatibilidade vigente até entrega própria.
- Cada arquivo tem um responsável por vez; nenhuma frente toca `data/*.json`, `.env*`, `.bashrc`, credenciais ou runtime real.

## 5. Grupamentos

### Fundação Electron e prova de empacotamento

**Objetivo:** provar o caminho Windows antes de espalhar adaptações pelo produto.

**Escopo por arquivo:** novo diretório `desktop/` para main, preload, contratos e Forge; ajustes delimitados em `package.json`, lockfile, `next.config.ts` e helpers novos de runtime edition. O implementador deve registrar arquivos adicionais necessários no relatório antes de tocá-los.

**Contratos:** instância única; janela somente loopback; navegação externa no navegador padrão; Studio/SoundCase/Calendar indisponíveis no desktop; `X` envia para tray; “Sair” encerra backend e Electron; autostart desligado por padrão; módulos nativos fora do `asar` e reconstruídos para o ABI Electron.

**Dependências:** Electron + Electron Forge; build desktop separado e base path vazio; nenhum efeito sobre a build web viva.

**Testes — camada interna:** unitários de edição, bridge, lifecycle, token local e configuração Forge; `npx tsc --noEmit`; `git diff --check`.

**Testes — camada externa:** workflow/runner Windows x64 empacota executável mínimo e comprova Next local, `better-sqlite3`, `@lancedb/lancedb`, DPAPI, tray, segunda instância e restart.

**Evidência de pronto:** instalador ou pacote Windows abre sem Node/npm, health local responde e banco/índice persistem. Se módulo nativo continuar sem carregar após rebuild/unpack, registrar `BLOCKED` e parar antes das frentes amplas.

**Preservar:** `chatgpt.service`, `.next` viva, `/chat`, dados privados, Studio, SoundCase, modelos e rotas web.

### Configurações, chave, modelos, pesquisa e identidade

**Objetivo:** tornar o desktop configurável e utilizável com a chave do usuário.

**Escopo por arquivo:** `SettingsDrawer`, catálogo/settings, composer/deepsearch, `MessageBubble`, CSS e novos adapters/rotas desktop de configuração e avatar.

**Contratos:** sem chave, dados locais continuam legíveis e ações OpenAI ficam bloqueadas com orientação; falha de validação não apaga chave funcional; catálogo mostra somente OpenAI suportada/disponível; pesquisa nunca troca o modelo; modelo incompatível bloqueia envio; avatares PNG/JPEG/WebP até 5 MB são recortados, reencodados em 512×512 e podem voltar ao padrão.

**Dependências:** fundação Electron aceita; bridge de segredo pronta; diretório de dados definido.

**Testes — camada interna:** estados da chave, redaction, catálogo/disponibilidade, compatibilidade de pesquisa, ausência de override, upload inválido e fallbacks de avatar.

**Testes — camada externa:** chat streaming e pesquisa citada com o modelo escolhido; persistência da chave e avatares após restart; QA em Daybreak/Midnight e tamanhos relevantes, sem overflow.

**Evidência de pronto:** selecionar Luna + Pesquisa High envia Luna com `web_search`; salvar/reabrir conserva os avatares; nenhuma chave aparece em localStorage, banco, logs ou artefato.

**Preservar:** Responses API, `useChat.ts` como orquestrador, balão do assistente 100%, orientação interna dos avatares, quick actions completas e alvos táteis.

### Memória V2 local e auditável

**Objetivo:** fazer SQLite V2 e recuperação semântica virarem a memória confiável do desktop.

**Escopo por arquivo:** `lib/server/memory-v2/*`, `lib/server/memory/*`, rotas/hooks de memória, context builder e seção Memória das configurações.

**Contratos:** SQLite V2 é autoridade exclusiva no desktop; fatos têm tópicos, versões, evidências, conflitos, operações e auditoria; pedido explícito aplica e permite desfazer; inferência vira sugestão; incompatibilidade cria conflito; falha de embedding não impede conversa/fatos; indexação é idempotente; índice derivado é reconstruído após importação.

**Dependências:** chave/configuração desktop e caminhos `userData` prontos.

**Testes — camada interna:** criação explícita, sugestão, edição/versionamento, conflito, rollback, limpeza do índice, fila/retry, limites de recuperação e importação transacional.

**Testes — camada externa:** conversa concluída alimenta busca; nova conversa recupera fatos/trechos relevantes; Memory Center mostra fonte e estado; fluxo continua quando embeddings falham.

**Evidência de pronto:** todos os comportamentos passam com dados sintéticos e restart real; não há dual-write JSON/SQLite.

**Preservar:** IDs/timestamps do legado, privacidade, memória tools somente no modo permitido e nenhum dado real como fixture.

### Pulse, Notas e execução em segundo plano

**Objetivo:** manter as superfícies operacionais locais sem systemd.

**Escopo por arquivo:** `lib/pulse/*`, rotas/componentes Pulse, Notas/Capturas e scheduler/tray Electron.

**Contratos:** tick a cada minuto e após resume; no máximo uma recuperação atrasada por rotina/retomada; locks impedem duplicidade; chave inválida produz erro acionável sem loop; fechar mantém tray, Sair encerra; modelos Pulse são OpenAI disponíveis; Notas, resultados, imagens, citações e áudio persistem e entram no backup.

**Dependências:** fundação desktop, chave e armazenamento estabilizados.

**Testes — camada interna:** scheduler, sleep/resume, idempotência, ausência de chave, execução manual, persistência e shutdown.

**Testes — camada externa:** rotina executa com a janela fechada; reabrir mostra o resultado; sair impede execução; próxima abertura faz uma única recuperação.

**Evidência de pronto:** smoke empacotado comprova tray, execução e restart sem systemd/Apache/porta fixa.

**Preservar:** regras atuais de recorrência, gravação de model/effort, cards/citações, MiniAudioPlayer e segurança contra efeitos externos em testes.

### Migração, instalador e fechamento integrado

**Objetivo:** produzir instalador reproduzível e passagem segura dos dados atuais.

**Escopo por arquivo:** exportador CLI/autenticado, importador desktop, workflow Windows, documentação canônica, `BACKLOG.md`, diário e relatório da entrega.

**Contratos:** exportação não altera produção nem inclui segredos/tokens/Studio/SoundCase/Calendar; primeiro início aceita perfil vazio ou importação; importação valida manifest/hashes e é transacional; índice é reconstruído; CI produz artefato x64 sem publicar release automaticamente; uninstall preserva perfil.

**Dependências:** todos os grupamentos anteriores estabilizados.

**Testes — camada interna:** manifest, hashes, backup com/sem senha, pacote corrompido, versão incompatível, rollback e exclusões obrigatórias.

**Testes — camada externa:** instalação limpa Windows 10/11 x64; onboarding; importação sintética; Chat, pesquisa, imagem, anexos, transcrição, TTS, avatares, memória, Notas e Pulse; restart; exportação/restauração; segredo scan.

**Evidência de pronto:** instalador funciona sem toolchain, gates completos passam e o relatório distingue implementado, validado em Windows, migração ensaiada e instalação real ainda não executada.

**Preservar:** produção, Apache, `.next`, dados reais, commits alheios e autorização separada para push/release/instalação real.

## 6. Gates completos e pontos de parada

No conjunto estabilizado:

1. Testes focados por grupamento.
2. `npm test`.
3. `npx tsc --noEmit`.
4. `npm run lint`.
5. `git diff --check`.
6. Build web em cópia/worktree isolada.
7. Build Next desktop e `electron-forge make` num runner Windows x64, um gate pesado por vez.
8. Smoke do app empacotado e inspeção de segredo.
9. QA visual Electron nas dimensões 1280×720, 1440×900 e janela mínima suportada.

Pontos de parada:

- Falha persistente de módulo nativo no pacote Windows.
- Necessidade de expor chave ao renderer ou gravá-la fora do DPAPI.
- Descoberta que exija modificar dados reais, produção ou contratos web para viabilizar o desktop.
- Mudança de resultado, inclusão de sync/cloud ou dependência de serviço externo além da OpenAI.

## 7. Relatório e fechamento

O relatório append-only usa uma seção por grupamento com arquivos tocados, `DECISÃO:`, gates com totais/exit real e bloqueios. O fechamento final registra: O que foi feito; Decisões e contratempos; Substituições e remoções; Próximos passos. Commit e push são separados; instalação real no Windows do Anders e publicação de release exigem autorização própria.
