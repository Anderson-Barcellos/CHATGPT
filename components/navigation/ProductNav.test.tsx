import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductNav } from "@/components/navigation/ProductNav";

describe("Gaucho product navigation", () => {
  it("marks SoundCase and keeps internal links base-path-safe", () => {
    const markup = renderToStaticMarkup(<ProductNav active="soundcase" />);
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain('class="gc-product-nav-desktop-only"');
    expect(markup).toContain('href="/soundcase"');
    expect(markup).toContain('aria-current="page"');
  });
});
