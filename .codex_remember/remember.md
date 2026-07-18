State:
- DeepSeek V4 Pro foi adicionado ao seletor como provider separado, apenas para chat padrao streaming.
- `lib/server/deepseekChat.ts` implementa o adapter DeepSeek, reasoning `max`, verbosity high via estado/UI, e tool local `fresh_web_context`.
- `fresh_web_context` chama OpenAI Responses com `web_search_preview`, `reasoning low`, verbosity high, injeta retorno como mensagem `tool` e faz um segundo turno DeepSeek sem tools.
- `DEEPSEEK_API_KEY` fica em `.env.production` ignorado pelo Git; `DEEPSEEK_WEB_CONTEXT_MODEL` deve seguir o default/documentado atual `gpt-5.6-luna` salvo override operacional deliberado. Nao expor segredos.

Next:
- Se Anders pedir fechamento Git, revisar diff, commitar/pushar para `origin/main`, e confirmar `git status --short --branch` limpo.

Context:
- Nao limpar dados runtime em `data/*.json`.
- Validacao ja feita nesta rodada: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run lint`, `git diff --check`, restart de `chatgpt.service`, health publico 200 e smoke autenticado real DeepSeek + tool web.
