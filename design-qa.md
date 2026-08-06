# Design QA — Gaucho Studio

**Data:** 2026-08-06
**Resultado final:** passed

## Evidência visual

- Referência aprovada: `/root/.codex/generated_images/019fd1cf-4dde-74d3-a380-1b379c8c0dea/exec-e74e881f-b566-4da1-8d7e-1bb0c4f131fc.png`
- Implementação desktop: `/tmp/gaucho-studio-option1-implementation.png`
- Comparação lado a lado: `/tmp/gaucho-studio-option1-comparison.png`
- Implementação mobile: `/tmp/gaucho-studio-mobile-implementation.png`
- Replay pós-revisão desktop: `/tmp/gaucho-studio-review-desktop.png`
- Replay pós-revisão mobile: `/tmp/gaucho-studio-review-mobile.png`
- Viewport nativo desktop em ambas as imagens: `1487 × 1058`, DPR 1
- Viewport mobile adicional: `390 × 844`, DPR 1
- Navegador: Google Chrome `149.0.7827.53` instalado no host, escolhido por Anders
- Método: Playwright regular com `executablePath=/usr/bin/google-chrome-stable`; o plugin Browser não estava disponível nesta sessão

## Fluxo validado

`/chat/studio` autenticado → Monaco renderiza → Run executa TypeScript localmente → Stop interrompe loop → CSP impede tentativa de rede → edição é salva → reload recupera o workspace → seletor mostra os modelos permitidos → pergunta contextual recebe resposta streaming terminal → Explorer mobile abre arquivo e fecha → composição permanece sem overflow horizontal.

## Comparação com a referência

| Superfície | Referência | Implementação | Resultado |
|---|---|---|---|
| Estrutura | rail e explorer à esquerda, editor/console no centro, assistente à direita | mesmas três colunas e proporções no viewport nativo | passed |
| Topo | status centralizado, estado salvo, Run e menu | posição, hierarquia e estados reproduzidos | passed |
| Explorer | projeto `calculadora-app`, árvore TypeScript e seleção azul | árvore, profundidade, seleção e configurações equivalentes | passed |
| Editor | abas, breadcrumbs, Monaco dark, linhas e syntax highlight | Monaco real local, abas funcionais, breadcrumbs e tema correspondentes | passed |
| Console | tabs, comando, resultado `42` e duração | mesmo arranjo; Run real atualiza resultado e duração | passed |
| Assistente | modelo, contexto do arquivo, mensagens e código copiável | mesma composição, conteúdo inicial equivalente e streaming funcional | passed |
| Sistema visual | navy profundo, bordas azuladas, cyan e verde semântico | Midnight Glass local com contraste e densidade equivalentes | passed |

## Diferenças de copy e desvios intencionais

- O console mostra `tsx src/utils/calculadora.ts`, o arquivo realmente executado, em vez do texto cenográfico `npx tsx src/index.ts` da referência.
- O contexto do arquivo é fixo e somente leitura: o arquivo ativo é sempre enviado, sem ação de agente ou aplicação automática.
- A composição mobile é dedicada ao uso real, com assistente em painel e navegação inferior; a referência escolhida define apenas o desktop.
- O runner v1 executa o arquivo ativo isoladamente; resolução de imports entre arquivos permanece fora deste bundle.

## Iterações de QA

- P1: Monaco permanecia vazio porque o loader tentava usar CDN bloqueado pela CSP. Corrigido para empacotar o `monaco-editor` local.
- P1: status do topo estava alinhado à esquerda. Centralizado como na referência.
- P2: tipografia estava densa e pequena. Escalas locais e padding do editor foram ajustados.
- P2: conversa inicial abria rolada para o fim. Auto-scroll ficou restrito ao streaming ativo.
- Passe final: nenhuma ocorrência P0, P1 ou P2 permaneceu; console e `pageerror` ficaram zerados.

## Interações principais

- Chat ↔ Studio por navegação de página.
- Seleção e fechamento de abas do editor.
- Execução TypeScript/JavaScript em Worker local com rede bloqueada e timeout.
- Autosave e restauração de arquivos, abas, modelo e histórico após reload.
- Runner autenticado com CSP `connect-src 'none'`, protocolo tokenizado, orçamento de saída e tentativa pública de rede sem request externo.
- Run/Stop com console associado ao arquivo efetivamente executado e estado interrompido explícito.
- Seletor de modelos, envio, stop e limpeza do chat contextual.
- Explorer móvel acessível pela navegação inferior; layout desktop e mobile sem overflow horizontal.
