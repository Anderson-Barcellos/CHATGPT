export const MOBILE_BREAKPOINT = 768;

// O painel operacional só encaixa ao lado do chat quando o quadro de mensagens
// mantém a largura máxima; abaixo disso ele flutua sobre o chat (não modal).
// O corte é a soma das peças, para acompanhar qualquer mudança nelas:
export const SHELL_RAIL_WIDTH_PX = 232; // --gc-shell-rail-width (14.5rem)
export const CONTEXT_PANEL_DOCKED_WIDTH_PX = 600; // teto de --gc-shell-context-width
// Balão do usuário min(76%, 42rem): 672 px pedem 884,2 px de área útil (o do
// assistente, min(88%, 46rem), enche antes, com 836,4 px).
export const MESSAGE_FRAME_FULL_WIDTH_PX = Math.ceil((42 * 16) / 0.76);
export const THREAD_PADDING_PX = 40; // .gc-chat-thread md:px-5
export const SHELL_CHROME_PX = 16; // 2 × --gc-shell-gutter + bordas do shell, trilha e painel
export const CONTEXT_SIDEBAR_BREAKPOINT =
  SHELL_RAIL_WIDTH_PX + CONTEXT_PANEL_DOCKED_WIDTH_PX + MESSAGE_FRAME_FULL_WIDTH_PX + THREAD_PADDING_PX + SHELL_CHROME_PX;

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
// lg: 1024 — sidebar becomes visible
// 1773 — context panel docks beside the chat (CONTEXT_SIDEBAR_BREAKPOINT); below it floats over the chat
