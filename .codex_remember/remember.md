State:
- `gemini-3.6-flash` foi adicionado ao seletor como provider separado, apenas para chat padrao streaming.
- `lib/server/geminiChat.ts` usa a Interactions API stateless (`store=false`) com Google Search, URL Context, thinking summaries e bridge para o SSE atual.
- Thinking Gemini oferece `minimal`, `low`, `medium` e `high`, com `medium` por padrao e preferencia persistida por modelo.
- Documento, Deepsearch e Quiz continuam nos modelos OpenAI forçados; GPT-5.6 Luna permanece o default global.
- Next/ESLint Config estao em `16.2.12`; PostCSS `8.5.23` e Sharp `0.35.3` sao overrides de seguranca.
- Docs canonicos concentrados em README + cinco arquivos sob `docs/`; nao ha PACK/BUNDLE ativo.
- Legado sem importador, handoffs concluidos, service worker desativado e estado efemero versionado foram removidos.

Next:
- Partir da `main` limpa e sincronizada para criar uma branch experimental dedicada apenas ao novo visual dark/glass.
- Preservar contratos, streaming, providers, dados runtime e comportamento; a nova frente deve se limitar a tokens, composição e responsividade.

Context:
- Nao limpar dados runtime em `data/*.json`.
- `GEMINI_API_KEY` fica somente no runtime ignorado pelo Git; nunca expor o valor.
- Calendar/OAuth server-side foi preservado; somente a antiga UI Agenda saiu.
- Validacao do baseline: 83 arquivos/288 testes, TypeScript, lint completo, build e audit de producao zero.
