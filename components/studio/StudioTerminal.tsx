"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import {
  createTerminalClientController,
  type StudioTerminalClientController,
  type StudioTerminalClientState,
} from "@/lib/studio/terminalClient";
import styles from "@/components/studio/GauchoStudioShell.module.css";

export function terminalStatusLabel(state: StudioTerminalClientState): string {
  switch (state.status) {
    case "idle":
      return "Terminal parado";
    case "connecting":
      return "Conectando…";
    case "open":
      return "Sessão ativa";
    case "error":
      return state.error ?? "Falha no terminal";
    case "closed":
      switch (state.exitReason) {
        case "idle":
          return "Sessão encerrada por inatividade";
        case "closed":
          return "Sessão encerrada";
        default:
          return "Sessão finalizada";
      }
  }
}

export function StudioTerminal() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<StudioTerminalClientController | null>(null);
  const [state, setState] = useState<StudioTerminalClientState>({
    status: "idle",
    exitReason: null,
    error: null,
  });
  // Incrementa para descartar e recriar a sessão do zero (reabrir limpa).
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      // Import dinâmico: xterm toca DOM/self e não pode entrar no bundle SSR.
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (cancelled) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        theme: { background: "#00000000" },
        allowTransparency: true,
        scrollback: 4_000,
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(host);
      fit.fit();

      const controller = createTerminalClientController();
      controllerRef.current = controller;
      const unsubscribe = controller.subscribe(() => {
        setState(controller.getState());
      });

      controller.connect({
        cols: terminal.cols,
        rows: terminal.rows,
        onData: (data) => terminal.write(data),
      });

      const inputDisposable = terminal.onData((data) => {
        controller.sendInput(data);
      });

      const resizeObserver = new ResizeObserver(() => {
        fit.fit();
        controller.sendResize(terminal.cols, terminal.rows);
      });
      resizeObserver.observe(host);
      terminal.focus();

      cleanup = () => {
        resizeObserver.disconnect();
        inputDisposable.dispose();
        unsubscribe();
        controller.dispose();
        controllerRef.current = null;
        terminal.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [generation]);

  const sessionOver =
    state.status === "closed" || state.status === "error";

  return (
    <div className={styles.terminalPane} aria-label="Terminal do workspace">
      <div className={styles.terminalHeader}>
        <span
          className={styles.terminalStatus}
          data-status={state.status}
          role="status"
        >
          {terminalStatusLabel(state)}
        </span>
        <div className={styles.terminalActions}>
          {sessionOver ? (
            <button
              type="button"
              className={styles.terminalActionButton}
              onClick={() => setGeneration((value) => value + 1)}
            >
              Nova sessão
            </button>
          ) : (
            <button
              type="button"
              className={styles.terminalActionButton}
              onClick={() => {
                void controllerRef.current?.close();
              }}
            >
              Encerrar
            </button>
          )}
        </div>
      </div>
      <div ref={hostRef} className={styles.terminalHost} />
    </div>
  );
}
