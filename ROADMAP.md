# 🧉 Gaúcho Chat — Roadmap

> Organizado do mais **simples** pro mais **bruxo**
> Atualizado: 4 de fevereiro de 2026

---

## ✅ Fase 1a — Limpeza de Código Morto (Concluída 03/02/2026)
**Esforço: ~1h | Impacto: ~1800 linhas removidas, build 17% mais rápido**

- [x] Remover `IMAGE_KEYWORDS` + `detectImageIntent()` + `useImageGen` de `InputArea.tsx`
- [x] Deletar `hooks/useAuth.ts` (auth é via Apache agora)
- [x] Deletar `hooks/queries/useChatQuery.ts` (chat usa Zustand direto)
- [x] Remover `usePrefetchConversation` de `useConversationQuery.ts` + `useConversations.ts`
- [x] Deletar `components/canvas/CodeEditorExample.tsx` (demo não usada)
- [x] Deletar `components/canvas/DiffViewerExample.tsx` (demo não usada)
- [x] Deletar `components/sidebar/Sidebar.tsx` (substituído por SidebarModern)
- [x] Deletar `components/layout/ChatShellModern.tsx.backup` (backup órfão)
- [x] Deletar `lib/storage/resilient-storage.ts` (nunca importado)
- [x] Deletar `lib/security/rateLimitEnhanced.ts` (nunca importado)
- [x] Limpar exports mortos em `components/canvas/index.ts`
- [x] Limpar `lib/performance/lazy.tsx` (142→34 linhas, só `useComponentPreloader`)
- [x] Limpar `lib/performance/debounce.ts` (277→27 linhas, só `useDebounce` + `useDebouncedSearch`)
- [x] Limpar barrel export `hooks/queries/index.ts`

---

## ✅ Fase 1b — Limpeza Restante (Concluída 03/02/2026)
**Esforço: ~20min | Impacto: 18 arquivos deletados, 2 deps npm removidas, build limpo**

> Auditoria de imports revelou arquivos que sobreviveram à Fase 1a.

### Arquivos órfãos removidos
- [x] Deletar `hooks/useImageGen.ts` (108 linhas)
- [x] Deletar `hooks/useMonacoEditor.ts`
- [x] Deletar `lib/performance/virtualList.tsx` (197 linhas)
- [x] Remover dep npm `@tanstack/react-virtual`
- [x] Deletar `lib/monitoring/telemetry.ts` (250 linhas)
- [x] Deletar `components/chat/SettingsPanel.tsx` (substituído por SettingsDrawer)
- [x] Deletar `components/settings/ModelSelector.tsx`

### Subsistema Canvas — code editor removido, RichContentViewer mantido
- [x] Deletar `components/canvas/CanvasContainer.tsx`
- [x] Deletar `components/canvas/MonacoEditor.tsx`
- [x] Deletar `components/canvas/DiffViewer.tsx`
- [x] Deletar `components/canvas/SimpleCodeEditor.tsx`
- [x] Deletar `components/canvas/index.ts`
- [x] Manter `components/canvas/RichContentViewer.tsx` (base do Artifact Panel futuro)

### API routes órfãs removidas
- [x] Deletar `app/api/images/route.ts`
- [x] Deletar `app/api/telemetry/route.ts`
- [x] Deletar `app/api/canvas/route.ts`

### Sentry — DECISÃO: remover tudo (sem DSN, não estava ativo)
- [x] Deletar `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- [x] Deletar `lib/monitoring/sentry.ts` (389 linhas de stub)
- [x] Desinstalar `@sentry/nextjs`
- [x] Remover `withSentryConfig` wrapper do `next.config.ts`
- [x] Limpar referências Sentry do `app/api/health/route.ts`
- [x] Limpar prefetch em `lazy.tsx` (atualizou para prefetch SettingsDrawer)
- [x] Limpar `lib/performance/index.ts` (removeu export virtualList)
- [x] Remover `SENTRY_DSN=` do `.env.production`
- [x] Build ✅ (compilou sem erros em 20.3s)

---

## ✅ Fase 2 — Features Rápidas (UI) (Concluída 03/02/2026)
**Impacto: UX visivelmente melhor**

- [x] **LaTeX/KaTeX** — `remark-math` + `rehype-katex` em `MessageContent.tsx` e `MessageBubble.tsx` (inline `$...$` e block `$$...$$`)
- [x] **Tabelas GFM** — já estava funcional com `remark-gfm` (verificado)
- [x] **Animações de entrada** — já implementado via Tailwind `animate-in fade-in-0 slide-in-from-bottom-2` (verificado)
- [x] **Copiar código** — já implementado com feedback Copy→Check em `CodeBlock.tsx` (verificado)

---

## ✅ Fase 3 — Performance (Concluída 03/02/2026)
**Impacto: Scroll suave no mobile, gradiente otimizado**

- [x] **Gradiente otimizado** — removido `background-attachment: fixed` (causa repaint/scroll jank), simplificado de 5→3 stops, adicionado `100dvh`
- [x] **Lazy Loading** — já funcional via `useComponentPreloader` (prefetch on idle)
- ❌ **VirtualList** — cancelado (nunca foi plugado; componente será deletado na Fase 1b)
- ⏸️ **Edge Caching** — N/A (todas as API routes são dinâmicas: streaming, auth)

---

## ⏸️ Fase 4 — Backend Hardening (Deprioritizada)
**Impacto: Baixo para uso pessoal single-user**

> Decisão: Overengineering para app pessoal atrás de Apache Basic Auth.
> Zod, middleware factory e logging estruturado não resolvem problemas reais do Anders.
- [ ] ~~**Validação Zod**~~ → único cliente é o próprio frontend
- [ ] ~~**Middleware factory**~~ → rate-limit atual + journalctl já cobrem
- [ ] ~~Logging estruturado~~ → journalctl já cobre

---

## ✅ Fase 4b — Persistência Server-side (Concluída 04/02/2026)
**Esforço: ~2-3h | Impacto: histórico persistente no servidor**

- [x] **API conversas** — `/api/conversations` + `/api/conversations/[id]`
- [x] **Storage server** — `data/conversations.json` com read/write seguro
- [x] **Client storage** — `lib/storage/conversations.ts` via fetch (sem Dexie para conversas)
- [x] **Persistência automática** — mensagens salvas ao enviar, histórico reaparece após reload
- [x] **Sidebar sincronizada** — lista reflete CRUD do servidor (create/delete/update)

---

## ✅ Fase 4c — Modelos & Limites (Concluída 04/02/2026)
**Esforço: ~1-2h | Impacto: respostas mais longas e consistentes**

- [x] **Limites maxOutput por modelo** — GPT‑5.2 128K, o3/o4‑mini 100K, GPT‑4.1/4o conforme tabela
- [x] **Remover cap global** — `/api/chat` não corta abaixo do limite do modelo
- [x] **Modelo removido** — GPT‑4.5 eliminado da lista
- [x] **Imagem padrão** — `gpt-image-1.5` como referência principal
- [x] **Warnings de streaming** — alinhados ao modelo de imagem atual
- [x] **Docs atualizados** — `docs/MODELS.md` e `docs/COMPONENTS.md`

---

## ✅ Fase 5 — Refinamento Visual (Tema "Deep Space") (Concluída 04/02/2026)
**Esforço: ~4-8h | Impacto: Visual premium, satisfação diária**

- [x] **Fundo "Deep Space"** — gradientes/radiais com modo claro + escuro
- [x] **Glassmorphism premium** — bordas translúcidas, backdrop-blur 20px+
- [x] **Micro-interações** — glow no hover, animações sutis em botões
- [x] **Tipografia hierárquica** — Space Grotesk + JetBrains Mono
- [x] **Modernização de layout** — app shell, sidebar, bolhas e composer mais premium
- [x] **Composer moderno** — chips arredondados, botão gradiente, espaçamento refinado
- [x] **Sidebar refinada** — cards, busca e cabeçalho mais “app-like”
- [x] **Balões sem truncamento** — conteúdo rico não corta mais (preview completo)

---

## ✅ Fase 6 — Mobile & UX Avançado (Concluída 04/02/2026)
**Esforço: ~3h | Impacto: Experiência mobile de primeira**

- [x] **Input responsivo** — safe-area-inset padding (notch/Dynamic Island), scrollIntoView fallback para teclado virtual, `interactiveWidget: resizes-content`
- [x] **Swipe gesture** — `useSwipeGesture` hook com edge detection, velocity threshold, proteção contra scroll vertical
- [x] **PWA completo** — manifest com basePath correto, scope, id estável, ícones 192+512, service worker, apple-web-app meta

### Bonus: Bugfixes de Conversas
- [x] **Fix init** — não cria "Nova conversa" fantasma a cada reload (seleção da mais recente)
- [x] **Fix switch** — limpa mensagens antes de carregar nova conversa (sem "ghost messages")
- [x] **Fix sidebar "Nova conversa"** — botão agora troca para a conversa criada
- [x] **Fix PUT parcial** — título e mensagens atualizados independentemente (sem sobrescrever)
- [x] **Auto-título** — primeira mensagem do usuário vira título da conversa (estilo ChatGPT)
- [x] **Limpeza** — removidas 8 conversas fantasma vazias do servidor

---

## Fase 7 — Monitoramento & Qualidade (Baixa Prioridade)
**Esforço: ~8-12h | Impacto: Produção profissional (overkill para uso pessoal)**

> Avaliação pragmática: para um app pessoal com 1 usuário, a maioria
> desses itens é hiperengenharia. journalctl + rate limit em memória já cobrem.

- [ ] **Sentry** — só se decidir ativar na Fase 1b (configurar DSN, source maps)
- [ ] ~~Redis rate limiting~~ → desnecessário sem horizontal scaling
- [ ] ~~Testes E2E~~ → baixo ROI para app em evolução rápida com 1 dev
- [ ] ~~Health monitoring dashboard~~ → `systemctl status` + `journalctl` já cobrem

---

## ✅ Fase 8 — Artifact Panel (estilo Claude.ai) (Concluída 04/02/2026)
**Esforço: ~2h | Impacto: Conteúdo rico renderizado em painel lateral**

> Sheet slide-in da direita com preview/fonte, copy/download, fullscreen.
> Estado global via uiStore — qualquer mensagem abre o painel.

- [x] **ArtifactPanel** — Sheet slide-in da direita, glassmorphism, responsive (92vw mobile, max-w-2xl desktop)
- [x] **Detecção de artifact** — `detectRichContent()` identifica HTML, markdown complexo, docs estruturados
- [x] **Renderização** — markdown completo (KaTeX, GFM, syntax highlight, rehype-raw), HTML/JS sandboxed em iframe
- [x] **Toggle preview/source** — tabs Preview/Fonte com ícones
- [x] **Export** — Copy to clipboard + Download (HTML ou Markdown)
- [x] **Fullscreen** — Maximize/Minimize toggle
- [x] **Estado global** — `uiStore.openArtifact()/closeArtifact()`, qualquer componente pode abrir
- [x] **Integração MessageContent** — botão "Abrir no painel" (PanelRightOpen icon) em mensagens ricas
- [ ] **Deep Research integration** — futuro (API modular, quando pronto)

---

## Fase 9 — O Grande Salto (Backlog)
**Esforço: ~20-40h | Impacto: De "app local" para "ferramenta profissional"**

- [ ] **Cloud Sync** — sincronização opcional de conversas (S3/R2 ou Postgres)
- [ ] **Backup criptografado** — export/import do banco local
- [ ] **Vercel AI SDK** — simplificar streaming, substituir ReadableStream manual
- [ ] **Multi-user** — suporte a múltiplos perfis com auth própria

---

## Legenda

| Emoji | Significado |
|-------|-------------|
| ✅ | Concluído |
| 🔄 | Em andamento |
| ⏸️ | Pausado |
| ❌ | Cancelado |

---

## Grafo de Dependências Ativo (referência)

```
page.tsx → ChatShell
  ├── SidebarModern        (useConversations, useDebouncedSearch)
  ├── ChatContainer        (useChat → MessageBubble → MessageContent → RichContentViewer)
  ├── InputArea            (useChat, modelConfig)
  ├── SettingsDrawer       (useMemories, useCustomInstructions)
  ├── ExportMenu           (useExport)
  ├── ThemeToggle
  └── SplashScreen

Stores: chatStore, settingsStore, uiStore
API:    /api/chat, /api/auth/*, /api/health
API+:   /api/conversations, /api/conversations/[id]
Libs:   modelConfig, buildInput, contextBuilder, systemPrompt, rateLimit, storage/*
Store:  data/conversations.json (server-side)
```

---

> **Mantido por**: Anders & Claude 🧉
