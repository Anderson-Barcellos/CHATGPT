# Repaginada Gaucho Chat — Lapidação Forte, Clínico Claro

## Direção Aprovada

Repaginar o shell atual sem trocar arquitetura, rotas ou contratos. O app continua sendo o Gaucho Chat com `workspace-v2`: rail de conversas à esquerda, chat no centro, painel operacional à direita, composer inferior e drawers no mobile.

Direção visual: **clínico claro**. Fundo frio e limpo, superfícies quase brancas, texto em ink, bordas finas, teal contido, estados verdes/âmbar discretos e menos competição visual entre header, composer e painel.

## Referências Visuais

- Conceito desktop final: `docs/assets/redesign/clinical-clear-desktop-concept.png`
- Conceito mobile/settings final: `docs/assets/redesign/clinical-clear-mobile-settings-concept.png`
- Conceito exploratório inicial: `/root/.codex/generated_images/019e88c1-ba59-76e3-a1bf-28c254c4e28f/ig_0f69e017ffe1c964016a1f0527029881918866293297735ce5.png`

## Funções Intocáveis

- Streaming, reasoning, citações, artifacts, export, TTS/Realtme lab, STT, anexos, edição, regeneração e histórico.
- `app/api/*`, storage JSON, auth/cookies, catálogo de modelos e defaults de runtime.
- Breakpoints atuais: mobile abaixo de `md`, rail compacto em `md`, sidebar completa em `lg`, painel dockado em `xl`.
- `data/conversations.json` e demais dados locais não entram na repaginada manual.

## Bundles

- **A1 — Design spec:** este documento e assets de conceito.
- **A2 — Tokens e shell:** tokens globais, moldura, header e superfícies principais.
- **A3 — Rail, header e composer:** reduzir ruído, melhorar scannability e separar input de ferramentas.
- **A4 — Chat, painel e settings:** mensagens mais documentais, painel operacional mais calmo e settings legível no mobile.
- **A5 — QA visual mobile/desktop:** screenshots, comparação com conceitos e validação técnica.

## Side Quest Implementada em Paralelo — Densidade Responsiva Mobile

Status: implementada como uma passada paralela ao fluxo Codex de refinamentos, depois do M1 inicial. A meta visual foi deixar resoluções mobile aproximadamente 15% mais compactas sem recorrer a `zoom`, `transform: scale()` global, viewport artificial ou redução de janela.

O contrato central de densidade/layout para o `workspace-v2` agora vive em `app/globals.css` por meio de tokens `--gc-mobile-*`, em vez de continuar acumulando ajustes locais de `padding`, `margin`, `height` e `radius` a cada breakpoint.

Direção adotada:

- Centralizar tokens semânticos para shell, header, subheader, composer, painéis, sheets, chips e controles recorrentes.
- Manter densidade compacta abaixo de `md`, com possibilidade futura de evoluir para degraus discretos (`comfortable`, `default`, `compact`) por viewport ou atributo `data-density`.
- Preservar tipografia deliberada; não escalar fonte por viewport. Ajustar primeiro espaçamento, altura, raio e agrupamento de controles.
- Migração inicial aplicada em `app/globals.css`, `WorkspaceLayoutV2`, `ChatContainer`, `ContextPanelV2`, `ConversationRailV2`, `AgendaPanelV2` e `SettingsDrawer`.
- Validar em iPhone grande em retrato, mobile menor, tablet, desktop `1440x900` e produção reiniciada, para evitar descompasso entre CSS novo e bundle servido.

Motivo: o ajuste compacto para iPhone 16 Pro Max mostrou que a ergonomia do shell depende de um conjunto coordenado de dimensões. Um sistema central reduz regressões nas próximas features e evita que cada componente invente seu próprio micro-layout.

## Critérios de Aceite

- Desktop `1440x900`: chat central domina a leitura, rail e painel não competem com a mensagem.
- Mobile `390x844`: header e composer não parecem espremidos; settings mantém tabs/rótulos legíveis.
- Composer preserva todos os controles existentes, com ações secundárias agrupadas no overflow mobile.
- Painel operacional segue útil, mas com timeline e notas visualmente mais leves.
- `npm test`, `npx tsc --noEmit`, `npm run build` passam antes de reiniciar produção.
