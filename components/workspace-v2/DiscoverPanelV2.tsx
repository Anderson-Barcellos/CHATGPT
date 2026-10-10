"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { ArrowLeft, Maximize2, Minimize2, Newspaper } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { MOBILE_MEDIA_QUERY } from "@/lib/layout/breakpoints";

const DiscoverFeed = dynamic(() => import("@/components/discover/DiscoverPage").then((module) => module.DiscoverFeed), {
  loading: () => <p role="status" className="p-4">Carregando notícias…</p>,
});
const MODAL_QUERY = `(max-width: 1023px), ${MOBILE_MEDIA_QUERY}`;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex="0"]';
function subscribe(callback: () => void) {
  const query = window.matchMedia(MODAL_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getSnapshot = () => window.matchMedia(MODAL_QUERY).matches;
const getServerSnapshot = () => false;

/** Uma única árvore para lateral e tela cheia: preserva feed, player e leitura. */
export function DiscoverPanelV2() {
  const expanded = useUIStore((state) => state.discoverExpanded);
  const setExpanded = useUIStore((state) => state.setDiscoverExpanded);
  const close = useUIStore((state) => state.closeDiscoverPanel);
  const compactViewport = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const modal = compactViewport || expanded;
  const panel = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const readingPosition = useRef<{ element: HTMLElement; offset: number } | null>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    back.current?.focus({ preventScroll: true });
    return () => {
      window.requestAnimationFrame(() => {
        if (opener?.isConnected && opener !== document.body && opener.getClientRects().length) {
          opener.focus({ preventScroll: true });
        } else {
          // O item da paleta e o link do drawer já podem ter sido desmontados.
          const fallback = Array.from(document.querySelectorAll<HTMLButtonElement>(
            'button[aria-label="Abrir conversas"], button[aria-label="Buscar conversas, notas e rotinas"]'
          )).find((node) => node.getClientRects().length && !node.closest('[inert]'));
          fallback?.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!modal || !panel.current) return;
    const node = panel.current;
    const siblings = Array.from(node.parentElement?.children ?? []).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== node
    );
    const previous = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    const focusInside = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) back.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", focusInside);
    if (!node.contains(document.activeElement)) back.current?.focus({ preventScroll: true });
    return () => {
      siblings.forEach((element, index) => { element.inert = previous[index]; });
      document.removeEventListener("focusin", focusInside);
    };
  }, [modal]);

  useLayoutEffect(() => {
    const position = readingPosition.current;
    const scroll = panel.current?.querySelector<HTMLElement>("[data-discover-scroll-root]");
    if (position && scroll) {
      scroll.scrollTop += position.element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - position.offset;
      readingPosition.current = null;
    }
  }, [expanded]);

  const toggleExpanded = () => {
    const scroll = panel.current?.querySelector<HTMLElement>("[data-discover-scroll-root]");
    if (scroll) {
      const top = scroll.getBoundingClientRect().top;
      const element = Array.from(scroll.querySelectorAll<HTMLElement>("h2, h3, p, li")).find((node) => node.getBoundingClientRect().bottom > top);
      if (element) readingPosition.current = { element, offset: element.getBoundingClientRect().top - top };
    }
    setExpanded(!expanded);
  };

  return (
    <aside
      ref={panel}
      data-workspace-region="discover"
      data-discover-fullscreen={modal}
      className="gc-discover-panel gc-clinical-rail gc-chat-ui"
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal || undefined}
      aria-labelledby="discover-panel-title"
      onKeyDown={(event) => {
        // A leitura modal não aciona atalhos do workspace que está inerte atrás dela.
        if (modal) event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (!modal || event.key !== "Tab") return;
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((node) => node.getClientRects().length && !node.closest('[hidden]'));
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <button ref={back} type="button" onClick={close} aria-label={compactViewport ? "Voltar ao chat" : "Voltar às conversas"} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
          <ArrowLeft className="size-5" />
        </button>
        <Newspaper className="size-4 shrink-0 text-primary" />
        <h2 id="discover-panel-title" className="min-w-0 flex-1 truncate font-semibold">Descobrir IA</h2>
        {!compactViewport && <button type="button" onClick={toggleExpanded} aria-label={expanded ? "Reduzir leitura" : "Ampliar leitura"} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
          {expanded ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </button>}
      </header>
      <DiscoverFeed embedded />
    </aside>
  );
}
