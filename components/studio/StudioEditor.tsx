"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { registerMonacoThemes } from "@/lib/monaco/theme";
import type { StudioFile } from "@/lib/studio/types";
import styles from "@/components/studio/GauchoStudioShell.module.css";

const MonacoEditor = dynamic(
  async () => {
    const [reactMonaco, monaco] = await Promise.all([
      import("@monaco-editor/react"),
      import("monaco-editor"),
    ]);
    reactMonaco.loader.config({ monaco });
    return reactMonaco.Editor;
  },
  {
    ssr: false,
    loading: () => <div className={styles.editorLoading} />,
  }
);

export interface StudioCompileResult {
  code: string;
  diagnostics: string[];
}

export interface StudioEditorHandle {
  compileActiveFile: () => Promise<StudioCompileResult>;
  focus: () => void;
}

interface StudioEditorProps {
  file: StudioFile;
  onChange: (content: string) => void;
  onReadyChange?: (ready: boolean) => void;
}

function configureMonaco(monaco: Monaco) {
  registerMonacoThemes(monaco);

  const compilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution:
      monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmitOnError: false,
    allowNonTsExtensions: true,
    allowJs: true,
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
    compilerOptions
  );
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
    compilerOptions
  );
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
}

function markerMessage(marker: editor.IMarker): string {
  const position = `L${marker.startLineNumber}:${marker.startColumn}`;
  return `${position} ${marker.message}`;
}

export const StudioEditor = forwardRef<StudioEditorHandle, StudioEditorProps>(
  function StudioEditor({ file, onChange, onReadyChange }, ref) {
    const { resolvedTheme } = useTheme();
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [ready, setReady] = useState(false);

    const handleMount = useCallback<OnMount>(
      (instance, monaco) => {
        editorRef.current = instance;
        monacoRef.current = monaco;
        setReady(true);
        onReadyChange?.(true);
        instance.focus();
      },
      [onReadyChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          editorRef.current?.focus();
        },
        async compileActiveFile() {
          const instance = editorRef.current;
          const monaco = monacoRef.current;
          const model = instance?.getModel();
          if (!instance || !monaco || !model) {
            throw new Error("O editor ainda está carregando.");
          }

          if (file.language === "javascript") {
            return { code: model.getValue(), diagnostics: [] };
          }

          if (file.language !== "typescript") {
            throw new Error("A execução local está disponível para TypeScript e JavaScript.");
          }

          const workerFactory =
            await monaco.languages.typescript.getTypeScriptWorker();
          const worker = await workerFactory(model.uri);
          const emit = await worker.getEmitOutput(model.uri.toString());
          const output = emit.outputFiles.find((candidate: { name: string; text: string }) =>
            candidate.name.endsWith(".js")
          );
          if (!output?.text) {
            throw new Error("O TypeScript não produziu JavaScript executável.");
          }

          const diagnostics = monaco.editor
            .getModelMarkers({ resource: model.uri })
            .filter(
              (marker: editor.IMarker) =>
                marker.severity === monaco.MarkerSeverity.Error ||
                marker.severity === monaco.MarkerSeverity.Warning
            )
            .map((marker: editor.IMarker) => markerMessage(marker));

          return { code: output.text, diagnostics };
        },
      }),
      [file.language]
    );

    return (
      <div className={styles.editorSurface} data-ready={ready}>
        <MonacoEditor
          path={file.path}
          language={file.language}
          value={file.content}
          theme={resolvedTheme === "light" ? "gc-light" : "gc-dark"}
          beforeMount={configureMonaco}
          onMount={handleMount}
          onChange={(value) => onChange(value ?? "")}
          saveViewState
          keepCurrentModel
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontFamily:
              "'Geist Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
            fontLigatures: true,
            fontSize: 14,
            lineHeight: 20,
            letterSpacing: 0.05,
            padding: { top: 5, bottom: 18 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            cursorBlinking: "smooth",
            renderLineHighlight: "line",
            renderWhitespace: "selection",
            wordWrap: "off",
            tabSize: 2,
            insertSpaces: true,
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
              highlightActiveIndentation: true,
            },
            stickyScroll: { enabled: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              verticalScrollbarSize: 7,
              horizontalScrollbarSize: 7,
              useShadows: false,
            },
            contextmenu: true,
          }}
        />
      </div>
    );
  }
);
