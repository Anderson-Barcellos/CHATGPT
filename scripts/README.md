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
