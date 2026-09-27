"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeViewportProbe,
  type ViewportProbeReport,
  type ViewportUnit,
} from "@/lib/layout/viewportProbe";

const RULER_PX = 160;
const LABEL_STEP_PX = 16;
const RULER_LABELS = Array.from({ length: RULER_PX / LABEL_STEP_PX }, (_, index) => index * LABEL_STEP_PX);
const STRIPES = "repeating-linear-gradient(to bottom, #ffffff 0 8px, #000000 8px 16px)";
const STRIPES_FROM_BOTTOM = "repeating-linear-gradient(to top, #ffffff 0 8px, #000000 8px 16px)";
const PROBE_PAGE_BACKGROUND = "#9dff00";

const UNIT_BARS: { unit: ViewportUnit; color: string; height: string }[] = [
  { unit: "vh", color: "#ff4d4d", height: "100vh" },
  { unit: "svh", color: "#ffd400", height: "100svh" },
  { unit: "lvh", color: "#00e5ff", height: "100lvh" },
  { unit: "dvh", color: "#ff00e5", height: "100dvh" },
];

function toPx(value: string): number {
  return Number.parseFloat(value) || 0;
}

/**
 * Página de diagnóstico com réguas no topo e na base, barras de 100vh/svh/lvh/dvh
 * e leituras cruas da viewport. Aberta pelo ícone da tela inicial, mostra onde o
 * blur do sistema termina e se a faixa de baixo é pintável.
 */
export function ViewportProbe() {
  const fixedBoxRef = useRef<HTMLDivElement>(null);
  const safeAreaRef = useRef<HTMLDivElement>(null);
  const unitRefs = useRef<Partial<Record<ViewportUnit, HTMLDivElement | null>>>({});
  const [report, setReport] = useState<ViewportProbeReport | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const measure = useCallback(() => {
    const fixedBox = fixedBoxRef.current;
    const safeArea = safeAreaRef.current;
    if (!fixedBox || !safeArea) return;

    const safeStyle = window.getComputedStyle(safeArea);
    const fixedRect = fixedBox.getBoundingClientRect();
    const unitHeight = (unit: ViewportUnit) => unitRefs.current[unit]?.getBoundingClientRect().height ?? 0;
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;

    setReport(
      describeViewportProbe({
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientHeight: document.documentElement.clientHeight,
        visualViewportHeight: window.visualViewport?.height ?? null,
        visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
        devicePixelRatio: window.devicePixelRatio,
        displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
        navigatorStandalone: typeof standalone === "boolean" ? standalone : null,
        unitHeights: {
          vh: unitHeight("vh"),
          svh: unitHeight("svh"),
          lvh: unitHeight("lvh"),
          dvh: unitHeight("dvh"),
        },
        safeArea: {
          top: toPx(safeStyle.paddingTop),
          right: toPx(safeStyle.paddingRight),
          bottom: toPx(safeStyle.paddingBottom),
          left: toPx(safeStyle.paddingLeft),
        },
        fixedBoxTop: fixedRect.top,
        fixedBoxBottom: fixedRect.bottom,
        userAgent: navigator.userAgent,
      })
    );
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.background, body: body.style.background };
    // Fundo chamativo: se a faixa de baixo ficar verde, o WebView pinta até ali.
    html.style.background = PROBE_PAGE_BACKGROUND;
    body.style.background = "transparent";

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    // Segunda leitura depois que o iOS assenta a viewport do standalone.
    const settle = window.setTimeout(schedule, 600);

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      html.style.background = previous.html;
      body.style.background = previous.body;
    };
  }, [measure]);

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard
      .writeText(report.json)
      .then(() => setCopyStatus("copied"))
      .catch(() => setCopyStatus("failed"));
  };

  return (
    <>
      {/* Mede os quatro env(safe-area-inset-*) via padding computado. */}
      <div
        ref={safeAreaRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed left-0 top-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
      />

      {/* Barras de 100vh/svh/lvh/dvh ancoradas no topo, lado direito. */}
      {UNIT_BARS.map(({ unit, color, height }, index) => (
        <div
          key={unit}
          ref={(node) => {
            unitRefs.current[unit] = node;
          }}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 z-20 w-2"
          style={{ height, right: 4 + index * 12, background: color }}
        />
      ))}

      {/* Régua do topo: listras de 8 px, rótulos a cada 16 px. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-10"
        style={{ height: RULER_PX, background: STRIPES }}
      >
        {RULER_LABELS.map((y) => (
          <span
            key={y}
            className="absolute left-[4.5rem] bg-[#ff0033] px-1 text-[10px] font-bold leading-[16px] text-white"
            style={{ top: y }}
          >
            {y}
          </span>
        ))}
        <div className="absolute inset-x-0 top-[env(safe-area-inset-top)] h-0.5 bg-[#ff0033]" />
      </div>

      {/* Régua da base: conta a partir da borda de baixo do position: fixed. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10"
        style={{ height: RULER_PX, background: STRIPES_FROM_BOTTOM }}
      >
        {RULER_LABELS.map((y) => (
          <span
            key={y}
            className="absolute left-[4.5rem] bg-[#0033ff] px-1 text-[10px] font-bold leading-[16px] text-white"
            style={{ bottom: y }}
          >
            {y}
          </span>
        ))}
        <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] h-0.5 bg-[#0033ff]" />
      </div>

      {/* Caixa position: fixed; inset: 0 (contorno magenta) que também rola o painel. */}
      <div
        ref={fixedBoxRef}
        className="fixed inset-0 z-30 overflow-y-auto outline outline-[3px] -outline-offset-[3px] outline-[#ff00e5]"
      >
        <div className="mx-4 my-[11rem] rounded-2xl bg-[#0b1220]/95 p-4 text-[13px] leading-snug text-white shadow-xl">
          <h1 className="text-base font-semibold">Sonda de viewport (temporária)</h1>
          <p className="mt-1 text-white/70">
            Abra pelo ícone da tela inicial e tire um print. Réguas: topo em vermelho, base em azul; linhas
            marcam os safe areas. Barras da borda direita pra dentro: vh vermelho, svh amarelo, lvh ciano, dvh
            magenta.
          </p>

          {report ? (
            <ul className="mt-3 list-disc space-y-1 pl-4">
              {report.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-white/70">Medindo…</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={measure}
              className="rounded-lg bg-white/15 px-3 py-2 font-semibold"
            >
              Medir de novo
            </button>
            <button
              type="button"
              onClick={copyReport}
              disabled={!report}
              className="rounded-lg bg-white/15 px-3 py-2 font-semibold disabled:opacity-50"
            >
              {copyStatus === "copied" ? "Copiado" : copyStatus === "failed" ? "Falhou; selecione abaixo" : "Copiar JSON"}
            </button>
            <Link href="/" className="rounded-lg bg-[#0f6f86] px-3 py-2 font-semibold">
              Voltar ao chat
            </Link>
          </div>

          {report && (
            <details className="mt-3">
              <summary className="cursor-pointer text-white/70">Leituras cruas</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2 text-[11px]">
                {report.json}
              </pre>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
