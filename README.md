# Gaucho Chat

Chat multimodal pessoal construído com `Next.js 16`, `React 19`, `TypeScript`, `Zustand`, `TanStack Query` e a OpenAI `Responses API`.

O app roda em produção em `https://ultrassom.ai/chat`, atrás do Apache, com `next start` gerenciado pelo `chatgpt.service`.
Alguns artefatos internos antigos ainda usam o rótulo histórico `Celer`, mas o nome visível do app e do shell atual é `Gaucho Chat`.

## O que o projeto faz

- Chat com streaming, reasoning visível por summary/tokens, web search, geração de imagens e code interpreter opcional.
- Histórico de conversas com persistência incremental durante streaming e recuperação de respostas interrompidas.
- Memórias, persona, instruções customizadas e preferências de TTS persistidas server-side.
- Player TTS nas respostas do assistente com modo turbo e laboratório separado de Realtime mini.
- Artefatos de documento/quiz com preview, download, impressão e PDF A4 server-side.
- Auth simples do app por usuário/senha, sessão JWT e cookie `auth-token`.
- Shell `workspace-v2` com direção clínica clara e densidade mobile compacta por tokens, sem `zoom` ou escala global.

## Stack

- `Next.js 16.1.6` com App Router e `basePath=/chat`.
- `React 19.2.3`, `TypeScript`, `Tailwind CSS 4`.
- `Zustand`, `TanStack Query`, `Radix UI`, `framer-motion`, `cmdk`.
- `OpenAI Node SDK 6.17.0`, `jose`, `Vitest`, `Playwright`.
- Persistência simples em JSON local sob `data/*.json`.

## Estrutura principal

```text
app/
  api/                  Rotas BFF: chat, auth, persona, memoria, PDF, TTS
  login/                Tela de login do app
components/
  chat/                 Balões, markdown, reasoning, ações rápidas e TTS
  settings/             Drawer de persona, memória, tuning e voz
  workspace-v2/         Shell atual do Gaucho Chat
hooks/
  useChat.ts            Orquestra streaming, persistência e anexos
lib/
  chat/                 Reducer de stream, reasoning e helpers de estado
  models/               Catálogo de modelos
  server/               Auth, limites de body e helpers server-side
  storage/              Persistência JSON e beacon
  tts/                  Sanitização, chunking e áudio TTS
data/
  conversations.json    Conversas locais
  memories.json         Memórias locais
  persona.json          Persona e preferências
```

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
