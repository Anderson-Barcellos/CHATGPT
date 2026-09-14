export const MOBILE_BREAKPOINT = 768;

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
// xl: 1280 — context panel becomes visible
