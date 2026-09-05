# Gaucho Chat

Chat multimodal pessoal construído com `Next.js 16`, `React 19`, `TypeScript`, `Zustand`, `TanStack Query` e a OpenAI `Responses API`.

O app roda em produção em `https://ultrassom.ai/chat`, atrás do Apache, com `next start` gerenciado pelo `chatgpt.service`.
Alguns artefatos internos antigos ainda usam o rótulo histórico `Celer`, mas o nome visível do app e do shell atual é `Gaucho Chat`.

## O que o projeto faz

- Chat com streaming, reasoning visível por summary/tokens, web search, geração de imagens, GPT-6 Astra, DeepSeek V4 Pro e Gemini 3.8 Flash no chat padrão, memory tools e code interpreter opcional.
- Histórico de conversas com persistência incremental durante streaming e recuperação de respostas interrompidas.
- Memórias, RAG local de conversas, persona, prompt principal visível, instruções customizadas e preferências de TTS persistidas server-side.
- Mini-player de áudio compartilhado entre respostas do chat e gerações Pulse, com TTS padrão em FLAC/turbo e Realtime 2.1 mini selecionável.
- Artefatos de documento/quiz com preview, download de fonte e PDF A4 server-side.
- Auth simples do app por usuário/senha, sessão JWT e cookie `auth-token`.
- Shell `workspace-v2` com o sistema visual **Atmosphere Glass** como padrão: Midnight Glass no escuro, Daybreak no claro e densidade mobile compacta por tokens, sem `zoom` ou escala global.
- **Gaucho Studio** em `/studio`: IDE Python separada com Monaco sobre o workspace do servidor, Explorer com criação/exclusão e pastas recolhíveis, run sandboxed com stdin, terminal PTY, notebooks `.ipynb` com kernel persistente, preview Markdown, autocomplete FIM DeepSeek e assistente contextual somente leitura.

## Stack

- `Next.js 16.2.12` com App Router e `basePath=/chat`.
- `React 19.2.3`, `TypeScript`, `Tailwind CSS 4`.
- `Zustand`, `TanStack Query`, `Radix UI`, `framer-motion`, `cmdk`.
- `OpenAI Node SDK 6.46.0`, Google GenAI SDK 2.13.0, `jose`, `Vitest`, `Playwright`.
- Persistência de produção em JSON local sob `data/*.json`; a fundação SQLite Memory V2 está integrada atrás de `MEMORY_V2_ENABLED`, ainda desativada e sem migração de dados reais.

## Estrutura principal

```text
app/
  api/                  Rotas BFF: chat, background, auth, persona, memoria/RAG, PDF, TTS, Pulse
  login/                Tela de login do app
  studio/               Página autenticada e separada do Gaucho Studio
components/
  chat/                 Balões, markdown, reasoning, ações rápidas e TTS
  settings/             Drawer de persona, memória, tuning e voz
  studio/               Explorer, Monaco, console, terminal, notebook e assistente contextual
  workspace-v2/         Shell atual do Gaucho Chat
hooks/
  useChat.ts            Orquestra streaming, persistência e anexos
  useStudioServerWorkspace.ts Ponte React para o workspace Python do servidor
lib/
  chat/                 Reducer de stream, reasoning e helpers de estado
  models/               Catálogo de modelos
  pulse/                Rotinas recorrentes, runner, scheduling e persistência Pulse
  server/               Auth, workspace/runner/terminal/kernel e helpers server-side
  studio/               Controller cliente, protocolos SSE, layout e formatos do Studio
  storage/              Persistência JSON e beacon
  tts/                  Sanitização, chunking e áudio TTS
data/
  conversations.json    Conversas locais
  chat-background-jobs.json Metadados de Documento/Deepsearch em background
  memories.json         Memórias locais
  persona.json          Persona e preferências
  workspace-notes.json  Capturas/notas locais (runtime privado)
```

## Sistema visual

O tema padrão vive em `app/globals.css` e é identificado por
`data-visual-theme="atmosphere-glass"` no `WorkspaceFrameV2`.

- **Midnight Glass**: modo escuro em navy profundo, superfícies translúcidas e acentos azul-frio.
- **Daybreak**: interpretação clara da mesma linguagem, com fundos clínicos azulados e contraste documental.
- Tokens de cor compartilhados ficam em `:root` e `.dark` para também alcançar `Sheet`, dropdowns e outros portais Radix montados diretamente sob `body`.
- Geometria, ambientação e tratamentos próprios do shell continuam restritos a `.gc-atmosphere-shell`, preservando o restante da aplicação.
- Verde fica reservado a estados semânticos, como disponibilidade, sucesso e conteúdo salvo.

## Documentação

- [Índice de docs](./docs/README.md)
- [API](./docs/API.md)
- [Arquitetura](./docs/ARCHITECTURE.md)
- [Infraestrutura](./docs/INFRASTRUCTURE.md)
- [Modelos](./docs/MODELS.md)

`AGENTS.md` é a memória operacional do projeto. Ele deve ser atualizado ao fim de rodadas relevantes, mas não substitui os documentos acima.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Por padrão, o dev server usa a porta `3040`. Em produção, o app depende de `NEXT_PUBLIC_BASE_PATH=/chat`.

## Validação

Use estes comandos conforme o risco da mudança:

```bash
npm test
npx tsc --noEmit
npm run build
npm run lint
```

Para mudanças de runtime/deploy, valide também:

```bash
systemctl restart chatgpt.service
curl -s http://127.0.0.1:3040/chat/api/health
curl -s https://ultrassom.ai/chat/api/health
```

## Notas de operação

- Não coloque segredos em documentação. `.env.production` e `.env.local` contêm credenciais reais.
- Não adicione rewrite com barra final para `/chat`; isso conflita com o `basePath` do Next.
- O cookie de auth precisa ficar em `Path=/chat`, sem barra final, para autenticar tanto `/chat` quanto `/chat/*`.
- O Apache canônico está em `/etc/apache2/sites-enabled/ultrassom.ai-optimized.conf`; o registro de portas/rotas fica em `/etc/apache2/APACHE.md`.
