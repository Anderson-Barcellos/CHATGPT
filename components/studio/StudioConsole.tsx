"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioConsoleEntry, StudioRunResult } from "@/lib/studio/types";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioConsoleProps {
  filePath: string | null;
  result: StudioRunResult | null;
  running: boolean;
  onClear: () => void;
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
  command,
}: StudioConsoleProps) {
  return (
    <section className={styles.consolePanel} aria-label="Saída da execução local">
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
                text: command ?? `tsx ${filePath}`,
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
    </section>
  );
}
