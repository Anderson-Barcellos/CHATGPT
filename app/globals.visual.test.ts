import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("Gaucho Chat visual contract", () => {
  it("does not scan archived Next.js output as Tailwind source", () => {
    expect(css).toContain('@source not "../.next-before-sc2-20260906T170822Z"');
  });

  it("loads Lexend with scoped typography instead of changing every product", () => {
    const bodyBlock = css.match(/body\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(css).toContain('@import "@fontsource/lexend/latin-400.css"');
    expect(css).toContain('@import "@fontsource/lexend/latin-500.css"');
    expect(css).toContain('@import "@fontsource/lexend/latin-600.css"');
    expect(css).toMatch(/\.gc-chat-ui\s*\{[\s\S]*font-family:\s*"Lexend"/);
    expect(bodyBlock).not.toContain('font-family: "Lexend"');
  });

  it("keeps panel motion short and disables it for reduced motion", () => {
    expect(css).toContain("animation: gc-panel-content-enter var(--gc-duration-normal)");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.gc-chat-ui \*/);
  });

  it("expresses the 92 percent mobile density through responsive tokens", () => {
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-controls-y:\s*0\.25rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-header-height:\s*2\.53125rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-control-height:\s*2\.5rem;/);
    expect(css).toMatch(/@media \(max-width: 359px\)[\s\S]*--gc-mobile-composer-control-height:\s*2\.125rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-send-size:\s*2\.5rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-segment-size:\s*2\.125rem;/);
    expect(css).toMatch(/@media \(max-width: 359px\)[\s\S]*--gc-mobile-composer-segment-size:\s*1\.75rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-textarea-font-size:\s*16px;/);
    expect(css).toContain("--gc-mobile-control-height: 2.5rem;");
    expect(css).toContain("--gc-mobile-icon-button-size: 2.5rem;");
    expect(css).toContain("--gc-mobile-touch-target: 2.5rem;");
    expect(css).toContain("--gc-composer-control-bg: rgb(112 148 187 / 15%);");
  });

  it("keeps coarse-pointer targets compact and usable only inside the mobile chat", () => {
    expect(css).toMatch(
      /@media \(max-width: 767px\) and \(pointer: coarse\)[\s\S]*\.gc-chat-ui \.gc-touch-target[\s\S]*min-width: var\(--gc-mobile-touch-target\)/
    );
  });

  it("treats short coarse landscape as mobile in Tailwind md and in the raw media blocks", () => {
    expect(css).toContain(
      "@custom-variant md (@media (min-width: 768px) and (not ((max-height: 500px) and (pointer: coarse))));"
    );
    const mobileList = "@media (max-width: 767px), ((max-height: 500px) and (pointer: coarse))";
    expect(css.split(mobileList).length - 1).toBeGreaterThanOrEqual(2);
    expect(css).toContain("@media (max-width: 767px) and (pointer: coarse), ((max-height: 500px) and (pointer: coarse))");
  });

  it("draws the mobile composer as one continuous glass capsule with an elastic model segment", () => {
    expect(css).toMatch(/\.gc-composer-capsule > \[data-composer-segment="model"\]\s*\{[^}]*flex: 1 1 auto;/);
    expect(css).not.toContain(".gc-composer-capsule > button:first-child");
    expect(css).toMatch(/\.gc-composer-capsule > button:not\(\[data-composer-segment\]\)\s*\{[^}]*width: var\(--gc-mobile-composer-segment-size\)/);
    expect(css).toMatch(/\.gc-composer-capsule\[data-recording="true"\]\s*\{[^}]*border-color:/);
    expect(css).toMatch(/\.gc-composer-capsule > button\[data-active="true"\]/);
  });

  it("follows the iOS visual viewport so the keyboard shrinks the shell instead of pushing it", () => {
    expect(css).toMatch(/\.gc-device-frame[\s\S]*height: var\(--gc-visual-viewport-height, 100dvh\)/);
    expect(css).toMatch(/\.gc-device-frame[\s\S]*transform: translateY\(var\(--gc-visual-viewport-offset-top, 0\)\)/);
    expect(css).toMatch(/html\[data-keyboard-open\] \.gc-composer-dock[\s\S]*padding-bottom: var\(--gc-mobile-composer-footer-bottom\)/);
    expect(css).toMatch(/\.gc-composer-dock[\s\S]*padding-bottom: var\(--gc-mobile-composer-footer-bottom\)/);
  });

  it("na PWA dá ao composer a safe area do indicador de home, descontada a faixa que o WebKit já deixa", () => {
    expect(css).toMatch(
      /html\[data-standalone\]:not\(\[data-keyboard-open\]\) \.gc-composer-dock\s*\{\s*padding-bottom: max\(\s*var\(--gc-mobile-composer-footer-bottom\),\s*calc\(env\(safe-area-inset-bottom\) - var\(--gc-standalone-bottom-gap, 0px\)\)\s*\);/
    );
  });

  it("keeps the iPhone welcome card compact enough for the splash actions", () => {
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-welcome-title-size:\s*1\.1rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-welcome-subtitle-size:\s*0\.68rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-welcome-action-font-size:\s*0\.56rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-welcome-footnote-size:\s*0\.64rem;/);
  });

  it("respects lateral safe areas for the Dynamic Island in landscape", () => {
    expect(css).toMatch(/\.gc-safe-x\s*\{[\s\S]*padding-left: env\(safe-area-inset-left\)[\s\S]*padding-right: env\(safe-area-inset-right\)/);
    expect(css).toMatch(/\.gc-safe-left\s*\{\s*padding-left: env\(safe-area-inset-left\)/);
    expect(css).toMatch(/\.gc-safe-right\s*\{\s*padding-right: env\(safe-area-inset-right\)/);
  });

  it("keeps mobile scrolling fluid: no per-bubble blur, contained overscroll and manipulation touch-action", () => {
    expect(css).toMatch(/\(pointer: coarse\)\)[\s\S]*\.gc-atmosphere-shell \.gc-assistant-bubble[\s\S]*backdrop-filter: none/);
    expect(css).toMatch(/\[data-radix-scroll-area-viewport\][\s\S]*overscroll-behavior: contain/);
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*touch-action: manipulation/);
  });

  it("keeps every mobile assistant state at the normal full response width", () => {
    expect(css).toMatch(
      /@media \(max-width: 767px\), \(\(max-height: 500px\) and \(pointer: coarse\)\)[\s\S]*\.gc-atmosphere-shell \.gc-assistant-bubble\s*\{[\s\S]*width: 100%;[\s\S]*max-width: 100% !important;/
    );
    expect(css).not.toContain("gc-assistant-bubble-active");
  });

  it("keeps mobile quick actions inside the assistant bubble", () => {
    const quickActionsBlock = css.match(
      /\.gc-atmosphere-shell \.gc-message-quick-actions\s*\{([^}]*)\}/g
    )?.at(-1) ?? "";

    expect(quickActionsBlock).toContain("width: fit-content;");
    expect(quickActionsBlock).toContain("max-width: 100%;");
    expect(quickActionsBlock).not.toMatch(/margin-(?:inline|left|right):\s*-/);
    expect(css).not.toContain("gc-message-quick-actions-wide");
  });

  it("does not keep dead mobile shell tokens duplicated on :root", () => {
    const rootMobile = css.match(/@media \(max-width: 767px\), \(\(max-height: 500px\) and \(pointer: coarse\)\) \{\s*:root \{([\s\S]*?)\n  \}/)?.[1] ?? "";
    expect(rootMobile).not.toContain("--gc-shell-rail-width");
    expect(rootMobile).not.toContain("--gc-shell-gutter");
  });

  it("mantém larguras do painel operacional por tokens e remove a sobreposição antiga", () => {
    const layout = readFileSync(new URL("../components/workspace-v2/WorkspaceLayoutV2.tsx", import.meta.url), "utf8");
    const shellTokenBlocks = css.match(/:root\s*\{[^}]*--gc-shell-rail-width:[^}]*\}/g) ?? [];

    expect(css).not.toContain(".gc-discover-panel");
    expect(layout).toContain("w-[var(--gc-shell-context-width)]");
    expect(layout).toContain("w-[var(--gc-shell-context-expanded-width)]");
    expect(css).toContain("--gc-shell-context-width: 500px;");
    expect(css).toContain("--gc-shell-context-expanded-width: 640px;");
    expect(css).not.toContain("@media (min-width: 96rem)");
    expect(shellTokenBlocks).toHaveLength(1);
    expect(layout).not.toContain("2xl:w-[");
    expect(layout).toContain("min-[1281px]:block");
    expect(layout).not.toContain("xl:block");
    expect(layout).toContain("{!desktopContext && (");
    expect(layout).toContain("<Sheet open={contextOpen} onOpenChange={setContextOpen}>");
    expect(layout).not.toContain("<Sheet open={contextOpen && !desktopContext}");
    expect(layout).toContain('overlayClassName="gc-context-drawer-overlay min-[1281px]:hidden"');
    expect(layout).toContain("gc-context-drawer gc-chat-ui");
    expect(css).not.toMatch(/\[data-workspace-region="context"\]\[data-collapsed="true"\]\s*\{[^}]*width/);
  });

  describe("régua tipográfica fluida do shell", () => {
    const remPx = 16;
    const chatUiBlock =
      css.match(/\/\* Chat-only type and motion contract[^*]*\*\/\s*(?:\/\*[\s\S]*?\*\/\s*)*\.gc-chat-ui\s*\{([^}]*)\}/)?.[1] ?? "";
    const mobileChatUiBlock =
      css.match(/@media \(max-width: 767px\), \(\(max-height: 500px\) and \(pointer: coarse\)\) \{[\s\S]*?\.gc-chat-ui\s*\{([^}]*)\}/)?.[1] ?? "";
    const themeBlock = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

    // Alvos em px: [token, mínimo em 768px, máximo em 1920px].
    const ladder: Array<[string, number, number]> = [
      ["nano", 11.5, 12.5],
      ["micro", 12, 13.5],
      ["caption", 13, 14.5],
      ["body-sm", 14, 15.5],
      ["body", 15, 17],
      ["h3", 16, 18.5],
    ];

    it.each(ladder)("interpola --gc-text-%s de %spx (768) a %spx (1920) com clamp()", (token, minPx, maxPx) => {
      const value = chatUiBlock.match(new RegExp(`--gc-text-${token}:\\s*([^;]+);`))?.[1] ?? "";
      const parts = value.match(
        /^clamp\(\s*([\d.]+)rem,\s*([\d.]+)rem \+ ([\d.]+)vw,\s*([\d.]+)rem\s*\)$/
      );

      expect(parts, `--gc-text-${token}: ${value}`).not.toBeNull();
      const [, min, base, slope, max] = parts!.map(Number);
      const at = (viewport: number) => base * remPx + (slope * viewport) / 100;

      expect(min * remPx).toBeCloseTo(minPx, 2);
      expect(max * remPx).toBeCloseTo(maxPx, 2);
      expect(Math.abs(at(768) - minPx)).toBeLessThan(0.05);
      expect(Math.abs(at(1920) - maxPx)).toBeLessThan(0.05);
    });

    it("liga text-xs e text-sm do Tailwind à mesma régua dentro do shell", () => {
      expect(chatUiBlock).toMatch(/--text-xs:\s*var\(--gc-text-micro\);/);
      expect(chatUiBlock).toMatch(/--text-sm:\s*var\(--gc-text-body-sm\);/);
    });

    it("registra os degraus body, h2 e h1 como utilitários (md:text-body do balão)", () => {
      expect(themeBlock).toMatch(/--text-body:\s*var\(--gc-text-body\);/);
      expect(themeBlock).toMatch(/--text-h2:\s*var\(--gc-text-h2\);/);
      expect(themeBlock).toMatch(/--text-h1:\s*var\(--gc-text-h1\);/);
    });

    it("preserva a densidade fixa do mobile, inclusive text-xs e text-sm", () => {
      expect(mobileChatUiBlock).not.toContain("clamp(");
      expect(mobileChatUiBlock).toMatch(/--gc-text-nano:\s*0\.6875rem;/);
      expect(mobileChatUiBlock).toMatch(/--gc-text-body-sm:\s*0\.875rem;/);
      expect(mobileChatUiBlock).toMatch(/--text-xs:\s*0\.75rem;/);
      expect(mobileChatUiBlock).toMatch(/--text-sm:\s*0\.875rem;/);
    });
  });

  it("dá ao título do painel operacional o mesmo degrau do cabeçalho do painel", () => {
    const layout = readFileSync(new URL("../components/workspace-v2/WorkspaceLayoutV2.tsx", import.meta.url), "utf8");

    expect(layout).toContain('<p className="text-body-sm font-semibold text-foreground">Painel operacional</p>');
  });

  it("mantém a hierarquia do painel: corpo expandido no degrau do título e seções sem passar o título no mobile", () => {
    const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
    const pulse = read("../components/workspace-v2/PulsePanelV2.tsx");
    const captures = read("../components/workspace-v2/WorkspaceCapturesPanelV2.tsx");
    const discover = read("../components/discover/DiscoverPage.tsx");
    const sectionTitles = [...pulse.matchAll(/<h3 className="([^"]*)"/g), ...captures.matchAll(/<h3 className="([^"]*)"/g)]
      .map((match) => match[1])
      .filter((classes) => !classes.includes("line-clamp") && !classes.includes("truncate"));

    expect(pulse).toContain('className="text-caption leading-relaxed md:text-caption"');
    expect(discover).toContain('"text-caption leading-relaxed md:text-caption"');
    expect(sectionTitles).toHaveLength(4);
    for (const classes of sectionTitles) expect(classes).toMatch(/\btext-xs md:text-body-sm\b/);
  });

  it("não usa tamanhos em px soltos no conteúdo do painel operacional", () => {
    const panelFiles = [
      "../components/workspace-v2/PulsePanelV2.tsx",
      "../components/workspace-v2/WorkspaceCapturesPanelV2.tsx",
      "../components/workspace-v2/ContextPanelV2.tsx",
    ];

    for (const file of panelFiles) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/text-\[\d+px\]/);
    }
  });

  it("lets the mobile panel density win over the desktop Atmosphere panel spacing", () => {
    const panelTokens = /--gc-mobile-(?:context-header-[xy]|panel-content-(?:pad|gap)):/;
    const rootBlocks = css.match(/^:root\s*\{[^}]*\}/gm) ?? [];
    const mobileRoot = css.indexOf("    --gc-mobile-context-header-x: 0.6375rem;");

    expect(mobileRoot).toBeGreaterThan(-1);
    expect(rootBlocks.filter((block) => panelTokens.test(block))).toHaveLength(1);
    expect(css.indexOf(rootBlocks.find((block) => panelTokens.test(block)) ?? "@@")).toBeLessThan(mobileRoot);
    expect(css).toContain("  --gc-mobile-panel-content-pad: 0.55rem;");
  });
});
