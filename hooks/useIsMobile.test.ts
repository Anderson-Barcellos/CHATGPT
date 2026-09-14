// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOBILE_BREAKPOINT, MOBILE_MEDIA_QUERY, SHORT_LANDSCAPE_MAX_HEIGHT } from "@/lib/layout/breakpoints";
import { useIsMobile } from "@/hooks/useIsMobile";

const queries: string[] = [];
let matches = false;
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latest: boolean | null = null;

function Harness() {
  const isMobile = useIsMobile();
  useEffect(() => {
    latest = isMobile;
  });
  return null;
}

beforeEach(() => {
  queries.length = 0;
  latest = null;
  window.matchMedia = vi.fn((query: string) => {
    queries.push(query);
    return {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(Harness));
  });
}

describe("breakpoints mobile", () => {
  it("considera mobile a largura estreita ou a paisagem curta com toque", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(SHORT_LANDSCAPE_MAX_HEIGHT).toBe(500);
    expect(MOBILE_MEDIA_QUERY).toBe(
      "(max-width: 767px), ((max-height: 500px) and (pointer: coarse))"
    );
  });
});

describe("useIsMobile", () => {
  it("consulta o matchMedia com a media query compartilhada", async () => {
    matches = true;
    await mount();
    expect(queries.every((query) => query === MOBILE_MEDIA_QUERY)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    expect(latest).toBe(true);
  });

  it("devolve false quando a media query não casa", async () => {
    matches = false;
    await mount();
    expect(latest).toBe(false);
  });
});
