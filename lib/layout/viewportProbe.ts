/**
 * Sonda temporária de viewport para o iOS 27 em web app da tela inicial.
 *
 * O WebKit em modo standalone passou a descontar a status bar da altura útil
 * e o sistema pinta uma faixa de blur sobre o topo. Esta função transforma as
 * leituras cruas do aparelho em conclusões objetivas (quanto falta embaixo,
 * o que alcança a borda) para calibrar a correção do layout.
 */

export type ViewportUnit = "vh" | "svh" | "lvh" | "dvh";

export interface ViewportProbeInput {
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
  clientHeight: number;
  visualViewportHeight: number | null;
  visualViewportOffsetTop: number | null;
  devicePixelRatio: number;
  displayModeStandalone: boolean;
  navigatorStandalone: boolean | null;
  unitHeights: Record<ViewportUnit, number>;
  safeArea: { top: number; right: number; bottom: number; left: number };
  /** Retângulo de um elemento `position: fixed; inset: 0`. */
  fixedBoxTop: number;
  fixedBoxBottom: number;
  userAgent: string;
}

export interface ViewportProbeReport {
  physicalHeight: number;
  bottomShortfall: number;
  shortfallMatchesTopInset: boolean;
  innerHeightReachesEdge: boolean;
  fixedBoxReachesEdge: boolean;
  unitsReachingEdge: ViewportUnit[];
  findings: string[];
  json: string;
}

/** Tolerância (px) para arredondamentos de subpixel. */
const EDGE_TOLERANCE_PX = 1;

const UNITS: ViewportUnit[] = ["vh", "svh", "lvh", "dvh"];

function reaches(value: number, edge: number): boolean {
  return value >= edge - EDGE_TOLERANCE_PX;
}

function yesNo(value: boolean): string {
  return value ? "sim" : "não";
}

export function describeViewportProbe(input: ViewportProbeInput): ViewportProbeReport {
  // No iOS `screen.width/height` não giram com o aparelho: a altura física da
  // orientação atual é o lado maior em retrato e o menor em paisagem.
  const landscape = input.innerWidth > input.innerHeight;
  const physicalHeight = landscape
    ? Math.min(input.screenWidth, input.screenHeight)
    : Math.max(input.screenWidth, input.screenHeight);

  const bottomShortfall = Math.max(0, Math.round(physicalHeight - input.clientHeight));
  const shortfallMatchesTopInset =
    bottomShortfall > 0 && Math.abs(bottomShortfall - input.safeArea.top) <= EDGE_TOLERANCE_PX;
  const innerHeightReachesEdge = reaches(input.innerHeight, physicalHeight);
  const fixedBoxReachesEdge = reaches(input.fixedBoxBottom, physicalHeight);
  const unitsReachingEdge = UNITS.filter((unit) => reaches(input.unitHeights[unit], physicalHeight));

  const findings = [
    `Tela na orientação atual: ${physicalHeight} px de altura.`,
    bottomShortfall > 0
      ? `Faltam ${bottomShortfall} px embaixo (tela − clientHeight)${shortfallMatchesTopInset ? ", igual ao safe-area-inset-top" : ""}.`
      : "Sem falta embaixo: a viewport ocupa a tela inteira.",
    `innerHeight (${input.innerHeight} px) alcança a borda: ${yesNo(innerHeightReachesEdge)}.`,
    `position: fixed; inset: 0 termina em ${Math.round(input.fixedBoxBottom)} px e alcança a borda: ${yesNo(fixedBoxReachesEdge)}.`,
    unitsReachingEdge.length > 0
      ? `Unidades que alcançam a borda: ${unitsReachingEdge.join(", ")}.`
      : "Nenhuma unidade (vh/svh/lvh/dvh) alcança a borda.",
    `Standalone: display-mode ${yesNo(input.displayModeStandalone)}, navigator.standalone ${input.navigatorStandalone === null ? "indisponível" : yesNo(input.navigatorStandalone)}.`,
  ];

  const summary = {
    physicalHeight,
    bottomShortfall,
    shortfallMatchesTopInset,
    innerHeightReachesEdge,
    fixedBoxReachesEdge,
    unitsReachingEdge,
  };

  return {
    ...summary,
    findings,
    json: JSON.stringify({ ...summary, input }, null, 2),
  };
}
