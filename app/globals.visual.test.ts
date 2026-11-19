import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTEXT_SIDEBAR_BREAKPOINT } from "@/lib/layout/breakpoints";

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

  it("encaixa o painel só a partir do corte derivado e flutua sem gaveta modal abaixo dele", () => {
    const layout = readFileSync(new URL("../components/workspace-v2/WorkspaceLayoutV2.tsx", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../components/workspace-v2/ContextPanelV2.tsx", import.meta.url), "utf8");
    const breakpoints = readFileSync(new URL("../lib/layout/breakpoints.ts", import.meta.url), "utf8");
    const shellTokenBlocks = css.match(/:root\s*\{[^}]*--gc-shell-rail-width:[^}]*\}/g) ?? [];
    const floating = css.match(/\.gc-context-floating\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(css).not.toContain(".gc-discover-panel");
    expect(shellTokenBlocks).toHaveLength(1);
    expect(css).toContain("--gc-shell-context-width: clamp(500px, 40vw, 600px);");
    expect(css).toContain("--gc-shell-context-expanded-width: clamp(640px, 50vw, 760px);");
    expect(layout).toContain("w-[var(--gc-shell-context-width)]");
    expect(layout).toContain("w-[var(--gc-shell-context-expanded-width)]");
    expect(breakpoints).toContain("CONTEXT_SIDEBAR_BREAKPOINT =");
    expect(layout).toContain(`min-[${CONTEXT_SIDEBAR_BREAKPOINT}px]:block`);
    expect(layout).not.toContain("min-[1281px]:block");
    // Faixa empilhada (max-[X] é "< X"): md:inline-flex solto vencia min-[…]:hidden pela ordem do CSS.
    expect(layout).toContain(`className="relative hidden md:max-[${CONTEXT_SIDEBAR_BREAKPOINT}px]:inline-flex"`);
    expect(layout).not.toMatch(/md:inline-flex min-\[\d+px\]:hidden/);
    expect(layout).not.toContain("xl:block");
    expect(layout).not.toContain("2xl:w-[");
    expect(layout).toContain('data-context-mode={desktopContext ? "docked" : "floating"}');
    expect(layout).toContain("{isMobile && (");
    expect(layout).not.toContain("{!desktopContext && (");
    expect(layout).toContain("<Sheet open={contextOpen} onOpenChange={setContextOpen}>");
    expect(layout).toContain("gc-context-drawer gc-chat-ui");
    expect(panel).not.toContain("min-[1281px]:hidden");
    expect(floating).toContain("position: absolute;");
    expect(layout).toContain('!desktopContext && "gc-context-floating"');
    expect(layout).toContain(`min-[${CONTEXT_SIDEBAR_BREAKPOINT}px]:block`);
    expect(floating).toMatch(/width: min\(var\(--gc-shell-context-width\), calc\(100% - 3rem\)\);/);
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

  describe("painel operacional como container", () => {
    const pulse = readFileSync(new URL("../components/workspace-v2/PulsePanelV2.tsx", import.meta.url), "utf8");
    const discover = readFileSync(new URL("../components/discover/DiscoverPage.tsx", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../components/workspace-v2/ContextPanelV2.tsx", import.meta.url), "utf8");

    it("declara o container gc-panel na raiz do painel, que serve ao aside e ao sheet", () => {
      expect(css).toMatch(/\.gc-panel-container\s*\{\s*container:\s*gc-panel\s*\/\s*inline-size;\s*\}/);
      expect(panel).toContain('className="gc-panel-container flex h-full flex-col"');
    });

    it("nomeia os cortes do painel num lugar só, com folga para a borda do aside", () => {
      const cut = (name: string) => Number(css.match(new RegExp(`@custom-variant ${name} \\(@container gc-panel \\(width >= ([\\d.]+)rem\\)\\);`))?.[1]) * 16;
      const [normalMin, normalMax, expandedMin] = [500, 600, 640]; // clamp() de --gc-shell-context-width e do ampliado
      const border = 2;

      expect(css).toContain("--gc-shell-context-width: clamp(500px, 40vw, 600px);");
      expect(css).toContain("--gc-shell-context-expanded-width: clamp(640px, 50vw, 760px);");
      // Confortável: todo painel desktop entra, celular em pé (até 440px) não.
      expect(cut("panel-cozy")).toBeGreaterThan(440);
      expect(cut("panel-cozy")).toBeLessThanOrEqual(normalMin - border);
      // Ampliado: nenhum painel normal entra, todo ampliado entra, mesmo descontada a borda.
      expect(cut("panel-wide")).toBeGreaterThan(normalMax);
      expect(cut("panel-wide")).toBeLessThanOrEqual(expandedMin - border);
    });

    it("decide a altura das capas do Pulse pela largura do painel, não pelo monitor", () => {
      expect(pulse).toContain('isExpanded ? "h-40 panel-cozy:h-52" : "h-24 panel-cozy:h-32"');
      expect(pulse).toContain('isExpanded ? "h-28 panel-cozy:h-40" : "h-20 panel-cozy:h-24"');
      expect(pulse).not.toMatch(/\bmd:h-(?:24|32|40|52)\b/);
    });

    it("decide a altura das capas do Descobrir embutido pela largura do painel e preserva a página", () => {
      expect(discover.match(/open \? "h-28 panel-cozy:h-40" : "h-20 panel-cozy:h-24"/g)).toHaveLength(2);
      expect(discover).not.toMatch(/\bmd:h-(?:24|40)\b/);
      // A página /discover independente segue com a regra de viewport dela.
      expect(discover).toContain('open ? "h-52 md:h-72" : "h-40"');
    });

    it("abre os cartões do Pulse em duas colunas no painel ampliado, com o aberto ocupando as duas", () => {
      expect(pulse).toContain('className="grid grid-cols-1 gap-2 panel-wide:grid-cols-2 panel-wide:grid-flow-row-dense"');
      expect(pulse).toContain('isExpanded && "panel-wide:col-span-2"');
    });

    it("abre os cartões do Descobrir embutido em duas colunas no painel ampliado, sem reordenar como a página", () => {
      expect(discover).toContain('"gap-[var(--gc-mobile-panel-content-gap)] panel-wide:grid-cols-2 panel-wide:grid-flow-row-dense"');
      expect(discover).toContain('open && embedded ? "panel-wide:col-span-2" : ""');
      // A página /discover independente mantém a regra de viewport e o salto do aberto para o topo.
      expect(discover).toContain('"gap-5 md:grid-cols-2"');
      expect(discover).toContain('open && !embedded ? "md:order-first md:col-span-2" : ""');
    });
  });

  describe("coluna do chat pelo próprio espaço", () => {
    const chat = readFileSync(new URL("../components/chat/ChatContainer.tsx", import.meta.url), "utf8");
    const bubble = readFileSync(new URL("../components/chat/MessageBubble.tsx", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../components/workspace-v2/WorkspaceLayoutV2.tsx", import.meta.url), "utf8");

    it("abre as boas-vindas em duas colunas pela largura da coluna do chat, sem remendo por viewport", () => {
      expect(css).toContain("@custom-variant chat-wide (@container gc-chat (width >= 50rem));");
      expect(chat).toContain("grid-cols-1 gap-6 chat-wide:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] chat-wide:gap-9");
      expect(chat).toContain("rounded-[2rem] border p-5 md:block chat-wide:p-7");
      expect(chat).not.toMatch(/\blg:(?:grid-cols|gap)-/);
      // A regra crua desfazia por container o que o lg: fazia por viewport.
      expect(css).not.toMatch(/@container gc-chat \(width < 800px\)/);
    });

    it("deixa a largura de thread, balões e composer com um dono só: o tema", () => {
      expect(css).toMatch(/\.gc-atmosphere-shell \.gc-chat-thread\s*\{[^}]*max-width:\s*var\(--gc-thread-max, 58rem\);/);
      expect(css).toMatch(/\.gc-atmosphere-shell \.gc-user-bubble\s*\{[^}]*max-width:\s*min\(76%, var\(--gc-user-bubble-max, 42rem\)\) !important;/);
      expect(css).toMatch(/\.gc-atmosphere-shell \.gc-assistant-bubble\s*\{[^}]*max-width:\s*min\(88%, var\(--gc-assistant-bubble-max, 46rem\)\) !important;/);
      expect(css).toMatch(/\.gc-atmosphere-shell \.gc-composer-width\s*\{[^}]*max-width:\s*var\(--gc-composer-max, 56rem\);/);
      // Classes de largura vencidas pelo tema eram código morto com corte de viewport.
      expect(bubble).not.toMatch(/max-w-\[(?:76%|78%|48rem|54rem)\]/);
      expect(chat).not.toMatch(/gc-chat-thread[^"]*max-w-/);
      expect(layout).toContain('className="gc-composer-width mx-auto"');
      for (const source of [chat, bubble, layout]) expect(source).not.toContain("min-[1490px]:");
    });

    it("não deixa órfãos os tokens que só serviam ao cartão de boas-vindas desktop", () => {
      expect(css).not.toMatch(/--gc-mobile-welcome-(?:panel-(?:x|y|radius)|grid-gap)\b/);
      expect(chat).not.toMatch(/--gc-mobile-welcome-(?:panel-(?:x|y|radius)|grid-gap)\b/);
    });
  });

  describe("polimentos de leitura", () => {
    it("equilibra títulos sem corte de linhas e deixa de fora o texto em streaming", () => {
      const rule = css.match(/\.gc-chat-ui :is\(h1, h2, h3\):not\(([^{]*)\)\s*\{\s*text-wrap:\s*balance;\s*\}/)?.[1] ?? "";

      // line-clamp: o Chrome ignora o equilíbrio em título cortado em N linhas.
      expect(rule).toContain('[class*="line-clamp"]');
      expect(rule).toContain("[data-streaming] *");
    });

    it("evita palavra órfã só em texto parado: painel operacional e Descobrir, nunca no balão do chat", () => {
      const selector = css.match(/([^{}]*)\{\s*text-wrap:\s*pretty;\s*\}/)?.[1] ?? "";

      expect(css.match(/text-wrap:\s*pretty/g)).toHaveLength(1);
      expect(selector).toContain(".gc-panel-container :is(p, li)");
      expect(selector).toContain("[data-discover-scroll-root] :is(p, li)");
      expect(selector).not.toMatch(/gc-message|gc-chat-thread|gc-assistant-bubble|gc-chat-ui/);
    });

    it("mantém os pares de altura com fallback: vh para navegador antigo, dvh para a barra móvel", () => {
      expect(css).toMatch(/body\s*\{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/);
      expect(css).toMatch(/\.gc-device-frame\s*\{\s*height:\s*100vh;\s*height:\s*100dvh;\s*\}/);
    });
  });
});
