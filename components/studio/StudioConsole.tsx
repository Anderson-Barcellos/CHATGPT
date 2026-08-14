"use client";

import { CornerDownLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StudioConsoleEntry, StudioRunResult } from "@/lib/studio/types";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioConsoleProps {
  filePath: string | null;
  result: StudioRunResult | null;
  running: boolean;
  onClear: () => void;
  onSendInput?: (text: string) => void;
  command?: string;
}

function ConsoleLine({ entry }: { entry: StudioConsoleEntry }) {
  return (
    <div className={cn(styles.consoleLine, styles[`console_${entry.level}`])}>
      <span className={styles.consolePrompt}>
        {entry.level === "command" ? "$" : entry.level === "error" ? "×" : "›"}
      </span>
      <span>{entry.text}</span>
    </div>
  );
}

export function StudioConsole({
  filePath,
  result,
  running,
  onClear,
  onSendInput,
  command,
}: StudioConsoleProps) {
  const [inputValue, setInputValue] = useState("");

  const submitInput = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue) return;
    onSendInput?.(inputValue);
    setInputValue("");
  };

  return (
    <section className={styles.consolePanel} aria-label="Saída da execução">
      <div className={styles.consoleTabs}>
        <span>Problemas <small>0</small></span>
        <span className={styles.consoleTabActive}>Saída</span>
        <div className={styles.consoleTools}>
          {result ? (
            <button type="button" onClick={onClear} aria-label="Limpar saída">
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.consoleBody} aria-live="polite">
        {filePath ? (
          <>
            <div className={styles.runStamp}>
              <span className={cn(styles.statusDot, running && styles.statusDotRunning)} />
              <strong>{running ? "[RUNNING]" : "[RUN]"}</strong>
            </div>
            <ConsoleLine
              entry={{
                id: "studio-command",
                level: "command",
                text: command ?? `python ${filePath}`,
              }}
            />
          </>
        ) : null}
        {result?.entries.map((entry) => (
          <ConsoleLine key={entry.id} entry={entry} />
        ))}
        {!running && !result ? (
          <div className={styles.consoleMuted}>Execute o arquivo para ver a saída.</div>
        ) : null}
        {!running && result ? (
          <div className={styles.consoleMuted}>
            Execução {result.status === "completed" ? "concluída com sucesso" : result.status === "aborted" ? "interrompida" : "finalizada com erro"} em {result.durationMs} ms.
          </div>
        ) : null}
      </div>

      {running && onSendInput ? (
        <form className={styles.consoleInputRow} onSubmit={submitInput}>
          <span className={styles.consolePrompt}>›</span>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Entrada para o programa (Enter envia)"
            aria-label="Entrada para o programa"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" aria-label="Enviar entrada" disabled={!inputValue}>
            <CornerDownLeft size={13} />
          </button>
        </form>
      ) : null}
    </section>
  );
}
