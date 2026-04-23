# Plano de Containerização — Sistema ultrassom.ai

**Data:** 2026-04-14 | **Status:** Planejamento (não executado)
**Escopo:** Gaúcho Chat, Vertex V2

---

## Visão Geral

| Projeto | Path | Complexidade | Docker Existente | Prioridade |
|---|---|---|---|---|
| Gaúcho Chat | `/root/CHATGPT` | Média | Parcial (com bugs) | 1ª |
| Vertex V2 | `/root/PROJECT/vertex-v2` | Baixa | Ausente | 2ª |

**Ordem recomendada:** Chat primeiro (infraestrutura já existe, só corrigir), Vertex segundo (SPA estático, mais simples).

---

## 1. Gaúcho Chat (`/root/CHATGPT`)

### Status atual
Stack Next.js 16, porta **3040** (systemd) vs **3000** (Docker — divergência).
Tem Dockerfile multi-stage, docker-compose.yml, .dockerignore — mas com problemas críticos.

### Problemas bloqueantes

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| B1 | `output: "standalone"` ausente | `next.config.ts` | Dockerfile quebra no COPY do standalone — **deploy impossível** |
| B2 | Volume `data/` não mapeado | `docker-compose.yml` | Conversas, memórias e persona perdidos ao recriar container |
| B3 | Porta divergente (3040 vs 3000) | `Dockerfile`, `docker-compose.yml`, `chatgpt.service` | Padronizar antes de subir |

### Problemas secundários

| # | Problema | Arquivo | Ação |
|---|---|---|---|
| S1 | `nginx/ssl/` vazio | `docker-compose.yml` | Prover `cert.pem` + `key.pem` ou remover nginx do compose no 1º deploy |
| S2 | `NEXT_PUBLIC_APP_URL` hardcoded | `docker-compose.yml` | Substituir por `${NEXT_PUBLIC_APP_URL}` |
| S3 | `data/` não está no `.dockerignore` | `.dockerignore` | Dados não devem ser baked na imagem |
| S4 | `systemd/`, `scripts/`, `apache-config/`, `.claude/` não estão no `.dockerignore` | `.dockerignore` | Reduz tamanho da imagem |
| S5 | `JWT_SECRET` fraco | `.env.production` | Gerar novo antes de produção |

### Checklist de execução

- [ ] Adicionar `output: "standalone"` ao `next.config.ts`
- [ ] Decidir porta (sugestão: manter **3040** para não quebrar Apache)
- [ ] Atualizar `Dockerfile`: `EXPOSE 3040` + `ENV PORT=3040`
- [ ] Atualizar `docker-compose.yml`: mapear `3040:3040` + adicionar volume `./data:/app/data`
- [ ] Atualizar `.dockerignore`: adicionar `data/`, `systemd/`, `scripts/`, `apache-config/`, `.claude/`
- [ ] Remover serviço `nginx` do compose ou prover certificados SSL
- [ ] Gerar novo `JWT_SECRET` forte
- [ ] Testar build: `docker compose build`
- [ ] Testar subida: `docker compose up -d`
- [ ] Validar rota `/chat` no Apache (proxy para porta 3040)

### Variáveis de ambiente necessárias (`.env.docker`)

```env
OPENAI_API_KEY=sk-...          # Obrigatória
JWT_SECRET=...                 # Gerar novo (32+ chars aleatórios)
AUTH_ENABLED=true
AUTH_PASSWORD=...              # Definir
PORT=3040
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/chat
```

---

## 2. Vertex V2 (`/root/PROJECT/vertex-v2`)

### Status atual
SPA React/Vite 100% estático, porta **8200**. Sem nenhum arquivo Docker.
Atualmente servido pelo Vite dev server via systemd — **problema de produção**.
Dois arquivos systemd conflitantes: `vertex-v2.service` (ativo) e `ultrassom-vite.service`.

### Estratégia recomendada

```
Stage 1 (build):  node:20-alpine — npm ci && npm run build → dist/
Stage 2 (serve):  nginx:alpine — serve dist/ sob /vertex/
```

Sem volumes necessários (persistência 100% client-side via localStorage).

### Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `Dockerfile` | Multi-stage: build Node → serve nginx |
| `.dockerignore` | Excluir node_modules, backups, .env, .git, .claude, dist |
| `.env.example` | Documentar as 9 variáveis `VITE_*` |
| `nginx.conf` (dentro do Docker) | Servir `/vertex/` com SPA fallback (`try_files`) |

### Problemas a resolver

| # | Problema | Ação |
|---|---|---|
| P1 | `strictPort: true` no vite.config.ts | Dentro do container a porta não precisa ser 8200 — nginx interno pode usar 80 e o host mapeia para 8200 |
| P2 | Proxy `/api/*` → `https://ultrassom.ai:8177` | Replicar no nginx.conf do container: `proxy_pass http://host.docker.internal:8177` ou definir `VITE_*_API_URL` diretamente |
| P3 | `base: '/vertex/'` no vite.config.ts | nginx precisa servir sob `/vertex/` com `location /vertex/` |
| P4 | `backups/` de 79 MB | Adicionar ao `.dockerignore` |
| P5 | Dois systemd services conflitantes | Desativar `ultrassom-vite.service` antes de migrar |

### Checklist de execução

- [ ] Criar `Dockerfile` multi-stage
- [ ] Criar `.dockerignore`
- [ ] Criar `.env.example` documentando `VITE_AUTH_USER`, `VITE_AUTH_PASS`, `VITE_AUTH_NAME` e variáveis de URL
- [ ] Criar `nginx.conf` com `location /vertex/`, SPA fallback, proxy `/api/` → backend IA
- [ ] Desativar `ultrassom-vite.service`: `systemctl disable ultrassom-vite.service`
- [ ] Testar build: `docker build -t vertex-v2 .`
- [ ] Testar subida e validar rota `/vertex/` no Apache

### Variáveis de ambiente necessárias (`.env.docker`)

```env
VITE_AUTH_USER=...             # Obrigatória
VITE_AUTH_PASS=...             # Obrigatória
VITE_AUTH_NAME=...             # Obrigatória
VITE_CLAUDE_API_URL=/api/claude
VITE_GEMINI_API_URL=/api/gemini
VITE_OPENAI_API_URL=/api/openai
```

---

## Resumo de Dependências entre Projetos

Os dois projetos são **independentes** entre si. A sequência recomendada considera complexidade e risco:

```
Chat (corrigir bugs existentes) → Vertex (criar do zero, simples)
```

## Arquivos de segredo que NUNCA vão para imagens

| Projeto | Arquivo | Conteúdo sensível |
|---|---|---|
| Chat | `.env.local`, `.env.production` | OPENAI_API_KEY, JWT_SECRET, AUTH_PASSWORD |
| Vertex V2 | `.env` | VITE_AUTH_USER, VITE_AUTH_PASS |

Todos devem ser injetados via `docker run --env-file` ou `docker compose` com arquivo `.env` externo à imagem.

---

*Plano gerado em 2026-04-14. Nenhuma alteração foi feita nos projetos.*
