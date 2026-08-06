State:
- Gaucho Studio implementado como página autenticada separada em `/studio` (`/chat/studio` público), seguindo a direção visual Midnight Glass escolhida por Anders.
- Projeto local TypeScript persiste no browser; Monaco transpila e o Web Worker autenticado executa com CSP sem rede, protocolo tokenizado, orçamento de saída, Stop e timeout.
- Chat lateral envia somente arquivo ativo + histórico curto para `/api/studio/assist`, com `store=false`, `tools: []` e sem aplicação automática.
- Chat e Studio possuem navegação direta entre páginas; dados runtime em `data/*.json` não foram tocados.
- A mesma árvore inclui Mermaid no markdown, GPT-5.6 Terra no catálogo e refinamentos visuais anteriores preservados.

Next:
- Avaliação multiagêntica consolidada, correções integradas e validação final fresca aprovada; faltam commits/push e a revisão de Anders.
- Depois do fechamento, decidir o contrato do autocomplete sem ampliar o chat para modo agente.

Context:
- Nao limpar dados runtime em `data/*.json`.
- Reutilizar `OPENAI_API_KEY` existente sem expor ou regravar o valor.
- Anders aceitou manter a chave atual por ser nova e limitada ao domínio; rotação não bloqueia esta frente.
- Runner v1 executa o arquivo ativo isoladamente e ainda não resolve imports entre arquivos.
- Workspace limita o histórico, faz flush ao sair e preserva primeiro os arquivos se o `localStorage` atingir a quota; stream sem terminal fica `interrupted`.
- Apache `/chat` alinha sua CSP à do Next para permitir Workers `blob:` sem retirar o cookie path escopado.
- Monaco mantém dois warnings de fallback do language worker para o thread principal; funcionalidade e runner isolado passam no Chrome público.
- Referência visual aceita: `/root/.codex/generated_images/019fd1cf-4dde-74d3-a380-1b379c8c0dea/exec-e74e881f-b566-4da1-8d7e-1bb0c4f131fc.png`.
- QA final: Google Chrome desktop/mobile, `design-qa.md` passed, 92 arquivos/318 testes, TypeScript, lint, build, audit, SSE real e health local/público aprovados.
