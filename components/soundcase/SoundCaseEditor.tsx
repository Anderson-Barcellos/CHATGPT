"use client";

import { FileUp, Plus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { GenerationWave } from "@/components/soundcase/GenerationWave";
import type { SoundCaseProgressView } from "@/lib/soundcase/progress";
import styles from "./SoundCase.module.css";

const MAX_TEXT_BYTES = 1024 * 1024;

export interface SoundCaseEditorProps {
  title: string;
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  progress?: SoundCaseProgressView | null;
  disabled?: boolean;
  onChange: (text: string) => void;
  onImport: (file: File) => Promise<void> | void;
  onCreate?: () => Promise<void> | void;
}

function durationLabel(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `~${minutes} min de áudio`;
}

export function SoundCaseEditor(props: SoundCaseEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [props.text]);

  if (props.onCreate && !props.title) {
    return (
      <main className={styles.editorStage}>
        <div className={styles.emptyPaper}>
          <SparkMark />
          <h1>Uma nova leitura começa aqui.</h1>
          <p>Crie um SoundCase para escrever, importar e ouvir textos longos.</p>
          <button type="button" onClick={() => void props.onCreate?.()}><Plus /> Novo SoundCase</button>
        </div>
      </main>
    );
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_TEXT_BYTES || !/\.(txt|md)$/iu.test(file.name)) {
      setImportError("Use um arquivo .txt ou .md de até 1 MB.");
      return;
    }
    setImportError(null);
    try { await props.onImport(file); }
    catch { setImportError("Não foi possível importar esse arquivo."); }
  };

  return (
    <main className={styles.editorStage}>
      <section className={styles.paper} aria-label="Texto do SoundCase">
        <div className={styles.paperTopline}>
          <span>{props.wordCount.toLocaleString("pt-BR")} palavras · {durationLabel(props.estimatedDurationSeconds)}</span>
          <button type="button" onClick={() => inputRef.current?.click()}><FileUp /> Importar</button>
          <input ref={inputRef} className={styles.hiddenInput} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </div>
        <h1>{props.title || "Sem título"}</h1>
        <p className={styles.paperHint}>Cole ou escreva seu texto. A direção será preparada automaticamente.</p>
        <textarea
          ref={textareaRef}
          className={styles.paperTextarea}
          aria-label="Texto para narração"
          value={props.text}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Comece a escrever…"
          spellCheck
        />
        {importError ? <p className={styles.editorError} role="alert">{importError}</p> : null}
        {props.progress ? <GenerationWave {...props.progress} status={props.progress.animated ? "active" : "settled"} /> : null}
      </section>
    </main>
  );
}

function SparkMark() {
  return <span className={styles.sparkMark} aria-hidden="true">✦</span>;
}
