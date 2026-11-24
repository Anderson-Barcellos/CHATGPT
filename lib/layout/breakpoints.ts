export const MOBILE_BREAKPOINT = 768;

// Larguras da trilha esquerda (expandida vs compacta) e do painel operacional:
export const SHELL_RAIL_WIDTH_PX = 232; // --gc-shell-rail-width (14.5rem)
export const SHELL_RAIL_COMPACT_WIDTH_PX = 52; // --gc-shell-rail-compact-width (3.25rem)
export const CONTEXT_PANEL_DOCKED_WIDTH_PX = 600; // teto de --gc-shell-context-width
export const CONTEXT_PANEL_EXPANDED_WIDTH_PX = 760; // teto de --gc-shell-context-expanded-width

// Tetos desktop do Atmosphere: usuário min(76%, 48rem), assistente min(88%, 56rem).
export const MESSAGE_FRAME_FULL_WIDTH_PX = Math.ceil(Math.max((48 * 16) / 0.76, (56 * 16) / 0.88));
export const THREAD_PADDING_PX = 40; // .gc-chat-thread md:px-5
export const SHELL_CHROME_PX = 16; // 2 × --gc-shell-gutter + bordas do shell, trilha e painel

// A partir de 1280px (notebooks padrão), o painel operacional encaixa lado a lado
// com o chat (auto-recolhendo a sidebar esquerda para 52px até 1679px).
export const CONTEXT_SIDEBAR_BREAKPOINT = 1280;

// Com o painel ampliado (640–760px), o encaixe lateral entra a partir de 1440px.
export const CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT =
  CONTEXT_SIDEBAR_BREAKPOINT + CONTEXT_PANEL_EXPANDED_WIDTH_PX - CONTEXT_PANEL_DOCKED_WIDTH_PX;

// A partir de 1680px, as 3 colunas (Sidebar 232px + Chat + Painel Operacional)
// convivem abertas simultaneamente sem precisar auto-recolher a sidebar esquerda.
export const THREE_COLUMN_FULL_BREAKPOINT = 1680;

// Altura máxima (px) em que um aparelho de toque em paisagem ainda é tratado
// como celular (iPhone 17 Pro Max em paisagem tem 440 pt de altura).
export const SHORT_LANDSCAPE_MAX_HEIGHT = 500;

// Media query única de "mobile": largura estreita OU paisagem curta com toque.
// É a mesma condição usada pelo variant `md` do Tailwind (negada) e pelos
// blocos `@media` crus em `app/globals.css`; alterar aqui exige alterar lá.
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px), ((max-height: ${SHORT_LANDSCAPE_MAX_HEIGHT}px) and (pointer: coarse))`;

// Breakpoint convention (matches Tailwind prefixes):
// md: 768  — mobile/tablet threshold; useIsMobile() uses MOBILE_MEDIA_QUERY
//            (max-width: 767px OR short coarse landscape ≤ 500px tall)
// lg: 1024 — sidebar expands by default (collapsible to 52px rail)
// 1280 — context panel docks beside the chat (CONTEXT_SIDEBAR_BREAKPOINT); below it floats over the chat
// 1440 — expanded context panel docks beside the chat (CONTEXT_EXPANDED_SIDEBAR_BREAKPOINT)
// 1680 — all 3 full columns fit simultaneously without auto-collapsing the left sidebar
