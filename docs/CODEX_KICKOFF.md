# Kickoff Codex - Refinamentos Gaucho Chat

## Objetivo

Continuar a lapidacao visual do Gaucho Chat sem trocar arquitetura, rotas, storage ou fluxos funcionais. O trabalho atual e de refinamento fino: densidade mobile, marca/cuiazinho, splash, composer e superficies do shell clinico.

## Estado Atual

- Shell ativo: `workspace-v2`, com rail de conversas, canvas central, painel operacional e composer inferior.
- Direcao visual aprovada: clinico claro, frio, documental, com teal contido e superficies suaves.
- Marca compartilhada: `components/ui/gpt-logo.tsx`, usada em login, splash, rail e empty state.
- Tokens visuais principais: `app/globals.css`, incluindo `--gc-clinical-*`, `gc-refined-*`, `gc-login-*` e `--gc-mobile-*`.
- Login recente: cuia como simbolo principal, sem alteracao na logica de auth.
- Densidade mobile: uma implementacao paralela ao fluxo Codex compactou o shell mobile em aproximadamente 15% via tokens `--gc-mobile-*`, sem `zoom`, sem `transform: scale()` global e sem viewport artificial.

## Escopo Seguro

- Ajustar escala, spacing, densidade e hierarquia visual em mobile.
- Refinar splash e brand tile, especialmente o bloco atras da cuia.
- Melhorar composer/header mobile sem remover controles.
- Lapidar cards, chips, tray de acoes e superficies internas ja existentes.
- Validar com screenshots Playwright em mobile e desktop.

## Fora De Escopo

- Alterar `app/api/*`, auth/cookies, storage JSON ou catalogo de modelos.
- Reescrever `workspace-v2` ou trocar breakpoints globais sem necessidade.
- Remover funcoes existentes: TTS, Realtime lab, STT, attachments, export, artifacts, regenerate, reasoning ou citacoes.
- Mexer em `data/conversations.json` e `data/persona.json` salvo se a tarefa for explicitamente de dados.

## Bundle M1 Historico — Mobile Compacto Sem Zoom

### M1 - Mobile 10% mais compacto sem zoom

Status: concluido em duas passadas. A primeira compactou o mobile em torno de 10%; a passada paralela posterior elevou o contrato para cerca de 15% usando tokens semanticos.

Objetivo original: fazer o layout mobile parecer cerca de 10% menor, sem usar `zoom`, `transform: scale()` no shell inteiro ou reduzir acessibilidade de toque de forma perigosa.

Abordagem recomendada:

- Criar tokens mobile de densidade em `app/globals.css`, por exemplo spacing, radius, card padding e altura de superficies.
- Aplicar em pontos visiveis: login, empty state, composer, chips do header, cards de sugestao e painel/drawers mobile.
- Manter touch targets principais proximos de 44px quando forem botoes reais.
- Reduzir tipografia pontual em superficies densas, evitando escalar fonte por viewport.
- Conferir em `390x844` e `430x932` antes de subir.

Resultado atual:

- `app/globals.css` centraliza tokens `--gc-mobile-*` para shell, header, subheader, composer, area do chat, welcome state, painel/contexto e settings.
- `WorkspaceLayoutV2`, `ChatContainer`, `ContextPanelV2`, `ConversationRailV2`, `AgendaPanelV2` e `SettingsDrawer` consomem esses tokens nos pontos principais.
- Ajustes futuros devem preferir mudar tokens em `app/globals.css`, nao voltar a espalhar valores locais de `px-*`, `py-*`, `h-*` e `rounded-*` no mobile.

## Proximo Bundle Recomendado

### M2 - QA visual e micro-ajustes apos densidade paralela

Objetivo: revisar a densidade compacta em browser real do Anders e ajustar apenas pontos que ficarem espremidos ou excessivamente pequenos.

Escopo sugerido:

- Capturar screenshots de workspace mobile, settings/drawer mobile, sidebar mobile e desktop `1440x900`.
- Afinar somente tokens `--gc-mobile-*` quando possivel.
- Nao trocar breakpoints, nao usar `zoom` e nao reabrir arquitetura do shell.

## Arquivos Provaveis

- `app/globals.css`
- `app/login/page.tsx`
- `components/chat/ChatContainer.tsx`
- `components/workspace-v2/WorkspaceLayoutV2.tsx`
- `components/workspace-v2/ChatCanvasV2.tsx`
- `components/workspace-v2/ConversationRailV2.tsx`
- `components/workspace-v2/ContextPanelV2.tsx`
- `components/settings/SettingsDrawer.tsx`

## Validacao Esperada

- `git diff --check`
- `npx tsc --noEmit`
- `npm run build`
- `systemctl restart chatgpt.service`
- Health local: `http://127.0.0.1:3040/chat/api/health`
- Health publico: `https://ultrassom.ai/chat/api/health`
- Screenshots Playwright: login mobile, workspace mobile, workspace desktop e settings/drawer mobile.

## Notas Para A Proxima Sessao

- A mudanca deve ser perceptivel, mas nao parecer "zoom out" artificial.
- O app e de uso pessoal do Anders, entao praticidade e legibilidade vencem pureza de design.
- Se algo parecer quebrado mas o health estiver OK, checar primeiro dark mode, splash/cache e assets `.next`.
- Ao mexer no `GPTLogo`, validar tambem em tamanho pequeno (`18-25px`).
- A densidade mobile atual veio como implementacao paralela ao fluxo Codex; nao tratar o M1 antigo como pendente.
