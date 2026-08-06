"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AlertTriangle, ChartNoAxesCombined, Code2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MermaidDiagramProps {
  source: string;
}

type MermaidRenderState =
  | { key: null; status: "loading"; svg: null }
  | { key: string; status: "ready"; svg: string }
  | { key: string; status: "error"; svg: null };

let mermaidRenderQueue: Promise<unknown> = Promise.resolve();

function queueMermaidRender(
  id: string,
  source: string,
  theme: "dark" | "neutral"
) {
  const renderTask = mermaidRenderQueue.then(async () => {
    const { default: mermaid } = await import("mermaid");

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme,
    });

    return mermaid.render(id, source);
  });

  mermaidRenderQueue = renderTask.catch(() => undefined);
  return renderTask;
}

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const reactId = useId();
  const renderCountRef = useRef(0);
  const { resolvedTheme } = useTheme();
  const [showSource, setShowSource] = useState(false);
  const [renderState, setRenderState] = useState<MermaidRenderState>({
    key: null,
    status: "loading",
    svg: null,
  });
  const normalizedSource = source.trim();
  const mermaidTheme = resolvedTheme === "dark" ? "dark" : "neutral";
  const renderKey = `${mermaidTheme}:${normalizedSource}`;

  useEffect(() => {
    let cancelled = false;

    if (!normalizedSource) {
      return () => {
        cancelled = true;
      };
    }

    renderCountRef.current += 1;
    const safeReactId = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
    const diagramId = `mermaid-${safeReactId}-${renderCountRef.current}`;

    void queueMermaidRender(diagramId, normalizedSource, mermaidTheme)
      .then(({ svg }) => {
        if (!cancelled) {
          setRenderState({ key: renderKey, status: "ready", svg });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRenderState({ key: renderKey, status: "error", svg: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidTheme, normalizedSource, reactId, renderKey]);

  const visibleStatus = !normalizedSource
    ? "error"
    : renderState.key === renderKey
      ? renderState.status
      : "loading";

  const sourceView = (
    <pre className="m-0 overflow-x-auto bg-zinc-950 p-4 text-left text-xs leading-6 text-zinc-100">
      <code>{source}</code>
    </pre>
  );

  return (
    <div
      data-mermaid-diagram="true"
      className="my-4 overflow-hidden rounded-xl border border-[color:var(--gc-border-soft)] bg-background/75 shadow-sm"
    >
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--gc-border-soft)] bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground/80">
          <ChartNoAxesCombined className="h-4 w-4 shrink-0 text-primary" />
          <span>Diagrama Mermaid</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setShowSource((current) => !current)}
          className="shrink-0 text-muted-foreground"
        >
          {showSource ? <Eye className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
          {showSource ? "Ver diagrama" : "Ver código"}
        </Button>
      </div>

      {showSource ? (
        sourceView
      ) : visibleStatus === "ready" && renderState.svg ? (
        <div
          role="img"
          aria-label="Diagrama Mermaid"
          className="overflow-x-auto p-4 text-center [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: renderState.svg }}
        />
      ) : visibleStatus === "error" ? (
        <div>
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Não foi possível renderizar este diagrama. Mantive o código original abaixo.
          </div>
          {sourceView}
        </div>
      ) : (
        <div
          aria-busy="true"
          className="flex min-h-36 items-center justify-center gap-2 p-4 text-sm text-muted-foreground"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Preparando diagrama…
        </div>
      )}
    </div>
  );
}
