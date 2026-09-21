# Relatório da frente TEXTO — Grok 4.7

## Resultado

O chat preserva Luna como padrão, mas identifica `gpt-5.4-mini` persistido como alias legado de `grok-4.7`. Grok usa a Responses API da xAI em `https://api.x.ai/v1`, com reasoning `medium` forçado no servidor. `XAI_API_KEY` tem precedência e `GROK_API_KEY` permanece aceito como alias operacional, sem gravar ou exibir credenciais.

O adaptador envia `web_search` e `code_execution` próprios da xAI. Memória mantém o loop de function calls existente. No chat padrão, a geração de imagem virou uma ponte de função restrita: o Grok pede `generate_image`, o servidor faz a chamada separada à OpenAI para `gpt-image-2` e reemite os eventos de `image_generation_call` consumidos pelo stream atual. Documento, Deepsearch e Quiz não recebem essa função.

Deepsearch médio, Documento forçado quando aplicável, Pulse, extração de rotinas, rascunho de agenda e Studio usam Grok no lugar do mini. O Studio preserva somente leitura, pesquisa web só no painel e nenhuma ferramenta em células; FIM não foi alterado. Pulse solicita texto ao provider selecionado e conserva a imagem como chamada OpenAI separada.

Os jobs OpenAI existentes continuam recuperáveis pelas rotas atuais. Para xAI, que não oferece `background=true`, a rota persiste um job antes de iniciar a execução server-side. O controlador fica em `globalThis`, o cancelamento aborta a chamada e o reconcile não classifica um job vivo como reinício. Um job xAI encontrado depois de restart é finalizado como interrompido, sem repetir automaticamente uma chamada que pode ter sido cobrada; há cerca contra resultado tardio após cancelamento.

## DECISÕES

- **Alias legado:** `gpt-5.4-mini` permanece aceito somente para leitura/resolução em `chatRequest` e Pulse. Não houve migração nem regravação de `data/*.json`.
- **Ferramentas:** xAI recebe ferramentas nativas para web/código. A ponte de imagem só aparece no modo padrão e só executa após function call explícita do modelo.
- **Background:** a persistência usa `provider: "openai" | "xai"`; registros antigos, sem provider, são interpretados como OpenAI.

## Validação

Executados na worktree, todos com código de saída `0`:

```text
npm test -- app/api/chat/route.test.ts lib/server/xaiChat.test.ts lib/server/chatRequest.test.ts lib/models/modelConfig.test.ts lib/chat/deepsearchConfig.test.ts lib/pulse/store.test.ts lib/pulse/runner.test.ts lib/pulse/runnerStart.test.ts lib/server/studioAssistant.test.ts hooks/useChat.test.ts lib/studio/workspace.test.ts hooks/useStudioPrefs.test.ts
62 testes aprovados em 11 arquivos.

git diff --check
```

Os testes do adaptador cobrem o alias de credencial, Grok/medium, as ferramentas xAI e as declarações de memória/ponte de imagem. A rota normal cobre o alias mini para Grok, streaming pelo adaptador e a falta explícita de credencial. As rotas e o hook existentes cobrem a sincronização de mensagens e os jobs OpenAI legados. A unidade Background, incluindo as cercas de cancelamento/restart, foi transferida ao principal durante a revisão e será revalidada com a implementação integrada dele.

`npx tsc --noEmit` conjunto foi executado depois de `npx next typegen` e retornou código `2`. Os quatro erros pertencem exclusivamente à frente de voz: tipo opcional incompatível em `components/soundcase/SoundCaseRealtimeBar.test.tsx`, dois acessos de tupla em `lib/server/soundcase/grokRealtime.test.ts` e `Float32Array<ArrayBufferLike>` em `lib/soundcase/grokRealtimeAudio.ts`. Não houve diagnóstico TypeScript em arquivo da frente TEXTO. Não rodei build, lint nem suíte completa, conforme a coordenação dos gates finais pelo principal.

O principal confirmou smoke direto do modelo com `GROK_API_KEY`: HTTP 200, resposta `completed`, 4,865 ms na primeira tentativa e 6,7 s na repetição, com usage incluindo reasoning. A asserção textual artificial de resposta exata `PRONTO` não foi aceita pelo modelo; portanto ela não demonstra aderência textual, apenas conectividade, disponibilidade do modelo e reasoning medium. Não houve nova chamada paga nesta frente.

## Escopo e pendências

Não removi imports nem módulos existentes; não alterei dados runtime, `.env*`, package files, `instrumentation.ts`, documentação canônica, serviços ou proxy. Os gates completos, integração visual e smoke pelo adaptador final ficam com o principal após estabilizar a frente de voz.
