# Scripts

Scripts utilitários locais do Gaucho Chat. O runtime oficial de produção é Apache + `chatgpt.service`; scripts legados de instalação/proxy que apontavam para fluxo antigo foram removidos para evitar drift.

## Disponíveis

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
