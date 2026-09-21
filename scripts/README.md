# Scripts

Scripts utilitários locais do Gaucho Chat. O runtime oficial de produção é Apache + `chatgpt.service`; scripts legados de instalação/proxy que apontavam para fluxo antigo foram removidos para evitar drift.

## Disponíveis

### `qa-grok-soundcase.mjs` e `qa-grok-catalog.mjs`

QA Playwright desktop/mobile com APIs interceptadas, dados sintéticos e sem cobrança. O primeiro cobre preferências e reprodução Realtime do SoundCase; o segundo cobre Luna default, ausência do mini, seleção/persistência do Grok e reasoning medium fixo. Usam `GROK_QA_BASE_URL` (default `http://127.0.0.1:3147/chat`) e `CHROME_PATH`; o SoundCase salva evidências em `GROK_QA_OUTPUT_DIR`. Executar contra instância isolada com `GAUCHO_ISOLATED_RUNTIME=true`, nunca contra dados reais.

### `smoke-grok-real.mjs`

Smoke **pago e explícito** de Grok 4.7 (`medium`) e texto → voz Realtime, sempre com texto sintético. Usa `XAI_API_KEY` ou `GROK_API_KEY` já exportada; não carrega arquivos de segredos nem imprime credenciais. `--text-only` e `--voice-only` limitam a rodada; `GROK_SMOKE_OUTPUT_DIR` permite salvar áudio WAV sintético. O teste encerra a conexão ao terminar/errar e limita áudio recebido a dois minutos. Os resultados distinguem latência, duração e custo estimado; escuta humana continua necessária para avaliar qualidade.

Executar somente em ambiente autorizado para chamadas reais; gates automatizados da entrega usam mocks.

### `pre-deploy.sh`

Checklist local mais amplo antes de rodada sensível.

Uso:

```bash
./scripts/pre-deploy.sh [--skip-build]
```

Valida Node, env local, TypeScript, ESLint, testes, build e alguns checks extras.

### `start-production.sh`

Builda e sobe o app localmente com `npm start` na porta `3040`, carregando `.env.production`.

Uso:

```bash
./scripts/start-production.sh
```

### `test-local.sh`

Smoke local simples do build com `NEXT_PUBLIC_BASE_PATH=/chat` e `PORT=3040`.

Uso:

```bash
./scripts/test-local.sh
```

### `generate-icons.mjs`

Script de apoio para gerar/atualizar ícones do app a partir dos assets de origem quando necessário.

### `smoke-studio-autocomplete.mjs`

Smoke determinístico do Monaco real. Intercepta apenas a rota FIM no contexto efêmero do Playwright e valida ghost text, `Tab`, undo, cancelamentos, troca de arquivo, toggle e ausência de requisições mobile sem persistir dados server-side.

Variáveis opcionais: `STUDIO_SMOKE_BASE_URL`, `STUDIO_SMOKE_USERNAME`, `STUDIO_SMOKE_PASSWORD` e `CHROME_PATH`.

### `smoke-studio-autocomplete-real.mjs`

Smoke curto do contrato FIM real com código sintético. Exige `DEEPSEEK_API_KEY` no ambiente e imprime somente o status final; não imprime chave, prompt ou completion.
