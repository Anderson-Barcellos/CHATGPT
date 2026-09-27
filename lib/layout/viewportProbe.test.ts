import { describe, expect, it } from "vitest";
import { describeViewportProbe, type ViewportProbeInput } from "@/lib/layout/viewportProbe";

// Números relatados no iOS 27 em web app da tela inicial (iPhone Pro Max,
// status bar black-translucent): a altura útil encolhe exatamente o inset do topo.
const IOS27_STANDALONE: ViewportProbeInput = {
  screenWidth: 440,
  screenHeight: 956,
  innerWidth: 440,
  innerHeight: 956,
  clientHeight: 894,
  visualViewportHeight: 894,
  visualViewportOffsetTop: 0,
  devicePixelRatio: 3,
  displayModeStandalone: true,
  navigatorStandalone: true,
  unitHeights: { vh: 894, svh: 894, lvh: 894, dvh: 894 },
  safeArea: { top: 62, right: 0, bottom: 34, left: 0 },
  fixedBoxTop: 0,
  fixedBoxBottom: 956,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)",
};

describe("describeViewportProbe", () => {
  it("mede a falta embaixo contra a tela e reconhece quando ela é o inset do topo", () => {
    const report = describeViewportProbe(IOS27_STANDALONE);

    expect(report.physicalHeight).toBe(956);
    expect(report.bottomShortfall).toBe(62);
    expect(report.shortfallMatchesTopInset).toBe(true);
  });

  it("diz quais medidas alcançam a borda de baixo", () => {
    const report = describeViewportProbe(IOS27_STANDALONE);

    expect(report.innerHeightReachesEdge).toBe(true);
    expect(report.fixedBoxReachesEdge).toBe(true);
    expect(report.unitsReachingEdge).toEqual([]);
  });

  it("não acusa falta quando a viewport ocupa a tela inteira", () => {
    const report = describeViewportProbe({
      ...IOS27_STANDALONE,
      clientHeight: 956,
      visualViewportHeight: 956,
      unitHeights: { vh: 956, svh: 956, lvh: 956, dvh: 956 },
    });

    expect(report.bottomShortfall).toBe(0);
    expect(report.shortfallMatchesTopInset).toBe(false);
    expect(report.unitsReachingEdge).toEqual(["vh", "svh", "lvh", "dvh"]);
  });

  it("usa a altura da tela na orientação atual (o iOS não gira screen.*)", () => {
    const report = describeViewportProbe({
      ...IOS27_STANDALONE,
      innerWidth: 956,
      innerHeight: 440,
      clientHeight: 440,
      visualViewportHeight: 440,
      unitHeights: { vh: 440, svh: 440, lvh: 440, dvh: 440 },
      safeArea: { top: 0, right: 62, bottom: 21, left: 62 },
      fixedBoxBottom: 440,
    });

    expect(report.physicalHeight).toBe(440);
    expect(report.bottomShortfall).toBe(0);
  });

  it("serializa as leituras cruas junto com as conclusões para colar no chat", () => {
    const report = describeViewportProbe(IOS27_STANDALONE);
    const parsed = JSON.parse(report.json);

    expect(parsed.input.clientHeight).toBe(894);
    expect(parsed.bottomShortfall).toBe(62);
    expect(report.findings.join("\n")).toMatch(/62 px/);
  });
});
