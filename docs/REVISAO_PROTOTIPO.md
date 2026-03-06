# Revisão do repositório (foco em protótipo)

Este documento resume uma leitura prática do projeto com foco em **velocidade de iteração** e **clareza para desenvolvimento**, sem exigir rigidez de produção.

## O que já está bem encaminhado

- Estrutura organizada por domínio (`app/api`, `components`, `hooks`, `stores`, `lib`).
- UI com boa modularização e separação entre shell/layout, chat, settings e artifacts.
- Persistência local/arquivo simples para conversas, suficiente para fase inicial.
- Middleware centralizando preocupações transversais (rate-limit, headers, CORS).

## Pontos para evoluir no contexto de protótipo

### 1) Fluxo de autenticação está incompleto no UX

As rotas de login/logout/check existem, mas não há um gate explícito na navegação principal para exigir login quando habilitado.

**Sugestão leve (protótipo):**
- Adicionar uma checagem no carregamento do app (ou no middleware) e redirecionar para `/login` quando `AUTH_ENABLED=true` e não houver sessão.

### 2) Renderização de markdown/html muito poderosa (bom) e arriscada (aceitável em protótipo)

O uso de `rehypeRaw` permite conteúdo rico. Em protótipo interno isso pode ser útil para testar artefatos rapidamente.

**Sugestão leve (protótipo):**
- Manter como está para acelerar testes.
- Se começar a compartilhar com terceiros, introduzir sanitização gradualmente.

### 3) Rotas de conversa sem validação de payload

Hoje o backend aceita payloads com validação mínima. Para protótipo, isso acelera.

**Sugestão leve (protótipo):**
- Adicionar apenas limites simples (`title` e `messages.length`) para evitar quebra acidental durante testes.

### 4) Observabilidade pragmática

Existe suporte de logging opcional no middleware.

**Sugestão leve (protótipo):**
- Ativar logging só em ambiente de teste interno.
- Registrar erros de API com contexto mínimo (rota + status), sem excesso de telemetria.

## Plano enxuto recomendado (1 sprint curta)

1. Adicionar gate básico de autenticação (UX + middleware).
2. Inserir validações mínimas nas rotas de conversa.
3. Manter `rehypeRaw` por enquanto (sem travar o ritmo).
4. Revisar novamente após primeiros feedbacks de uso real.

## Conclusão

Para **protótipo funcional**, o repositório está em bom caminho: arquitetura clara, componentes reutilizáveis e APIs objetivas.

O principal ajuste de curto prazo é reduzir fricções de uso (login/gate) e prevenir quebra acidental de dados (validação mínima), sem entrar em hardening completo de produção.
