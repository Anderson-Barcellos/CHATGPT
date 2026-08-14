"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import type { Monaco, OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { registerMonacoThemes } from "@/lib/monaco/theme";
import {
  registerStudioAutocompleteProvider,
  type StudioAutocompleteProviderHandle,
} from "@/lib/studio/autocompleteProvider";
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
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

export interface StudioEditorHandle {
  focus: () => void;
}

interface StudioEditorProps {
  file: StudioFile;
  autocompleteEnabled: boolean;
  onChange: (content: string) => void;
  onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
  onReadyChange?: (ready: boolean) => void;
  onRunShortcut?: () => void;
}

function configureMonaco(monaco: Monaco) {
  registerMonacoThemes(monaco);
}

export const StudioEditor = forwardRef<StudioEditorHandle, StudioEditorProps>(
  function StudioEditor(
    {
      file,
      autocompleteEnabled,
      onChange,
      onAutocompleteStatusChange,
      onReadyChange,
      onRunShortcut,
    },
    ref
  ) {
    const { resolvedTheme } = useTheme();
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const autocompleteRef = useRef<StudioAutocompleteProviderHandle | null>(
      null
    );
    const autocompleteMediaCleanupRef = useRef<(() => void) | null>(null);
    const autocompleteEnabledRef = useRef(autocompleteEnabled);
    const filePathRef = useRef(file.path);
    const autocompleteStatusRef = useRef(onAutocompleteStatusChange);
    const readyChangeRef = useRef(onReadyChange);
    const runShortcutRef = useRef(onRunShortcut);
    const [ready, setReady] = useState(false);

    autocompleteEnabledRef.current = autocompleteEnabled;
    filePathRef.current = file.path;
    autocompleteStatusRef.current = onAutocompleteStatusChange;
    readyChangeRef.current = onReadyChange;
    runShortcutRef.current = onRunShortcut;

    const handleMount = useCallback<OnMount>(
      (instance, monaco) => {
        autocompleteMediaCleanupRef.current?.();
        autocompleteRef.current?.dispose();
        editorRef.current = instance;
        monacoRef.current = monaco;
        const desktopQuery = window.matchMedia(
          "(min-width: 861px) and (pointer: fine)"
        );
        autocompleteRef.current = registerStudioAutocompleteProvider({
          monaco,
          editor: instance,
          isEnabled: () => autocompleteEnabledRef.current,
          isDesktop: () => desktopQuery.matches,
          getFilePath: () => filePathRef.current,
          onStatusChange: (status) =>
            autocompleteStatusRef.current?.(status),
        });
        const syncDesktopCapability = () => {
          autocompleteRef.current?.setEnabled(
            autocompleteEnabledRef.current
          );
        };
        desktopQuery.addEventListener("change", syncDesktopCapability);
        autocompleteMediaCleanupRef.current = () => {
          desktopQuery.removeEventListener("change", syncDesktopCapability);
        };
        // Sobrescreve o insertLineAfter padrão do Monaco: Ctrl/Cmd+Enter roda
        // o arquivo, coerente com o atalho global do shell.
        instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          runShortcutRef.current?.();
        });
        setReady(true);
        onReadyChange?.(true);
        instance.focus();
      },
      [onReadyChange]
    );

    useEffect(() => {
      autocompleteRef.current?.setEnabled(autocompleteEnabled);
    }, [autocompleteEnabled]);

    useEffect(() => {
      return () => {
        autocompleteMediaCleanupRef.current?.();
        autocompleteMediaCleanupRef.current = null;
        autocompleteRef.current?.dispose();
        autocompleteRef.current = null;
        editorRef.current = null;
        monacoRef.current = null;
        readyChangeRef.current?.(false);
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          editorRef.current?.focus();
        },
      }),
      []
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
