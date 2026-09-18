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
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-controls-y:\s*0;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-header-height:\s*2\.53125rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-control-height:\s*1\.9rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*--gc-mobile-composer-send-size:\s*2\.0625rem;/);
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

  it("follows the iOS visual viewport so the keyboard shrinks the shell instead of pushing it", () => {
    expect(css).toMatch(/\.gc-device-frame[\s\S]*height: var\(--gc-visual-viewport-height, 100dvh\)/);
    expect(css).toMatch(/\.gc-device-frame[\s\S]*transform: translateY\(var\(--gc-visual-viewport-offset-top, 0\)\)/);
    expect(css).toMatch(/html\[data-keyboard-open\] \.gc-composer-dock[\s\S]*padding-bottom: var\(--gc-mobile-composer-footer-bottom\)/);
    expect(css).toMatch(/\.gc-composer-dock[\s\S]*padding-bottom: var\(--gc-mobile-composer-footer-bottom\)/);
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
});
