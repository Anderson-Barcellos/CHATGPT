export const STUDIO_WORKSPACE_MAX_RELATIVE_PATH_CHARS = 320;
export const STUDIO_WORKSPACE_MAX_EDITABLE_FILE_BYTES = 1024 * 1024;
export const STUDIO_WORKSPACE_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const STUDIO_WORKSPACE_MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
export const STUDIO_WORKSPACE_MAX_ZIP_ENTRIES = 2_000;

export type StudioWorkspaceRunStatus =
  | "completed"
  | "failed"
  | "timeout"
  | "aborted";

export interface StudioWorkspaceTreeEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  size: number;
  editable: boolean;
}

export type StudioWorkspaceRunEvent =
  | { type: "console"; level: "log" | "error" | "command"; text: string }
  | { type: "status"; status: StudioWorkspaceRunStatus; durationMs: number };

export type StudioTerminalExitReason = "exited" | "closed" | "idle";

export type StudioTerminalEvent =
  | { type: "data"; data: string }
  | { type: "exit"; reason: StudioTerminalExitReason };

export type StudioNotebookKernelStatus = "starting" | "idle" | "busy";

export type StudioNotebookKernelExitReason = "closed" | "idle" | "died";

export type StudioNotebookOutput =
  | { kind: "stream"; name: "stdout" | "stderr"; text: string }
  | {
      kind: "execute_result";
      data: Record<string, string>;
      executionCount: number | null;
    }
  | { kind: "display_data"; data: Record<string, string> }
  | { kind: "error"; ename: string; evalue: string; traceback: string[] };

export type StudioNotebookEvent =
  | { type: "kernel_status"; status: StudioNotebookKernelStatus }
  | { type: "cell_started"; cellId: string }
  | { type: "cell_output"; cellId: string; output: StudioNotebookOutput }
  | {
      type: "cell_done";
      cellId: string;
      status: "ok" | "error";
      executionCount: number | null;
    }
  | {
      type: "input_request";
      cellId: string;
      prompt: string;
      password: boolean;
    }
  | { type: "kernel_exit"; reason: StudioNotebookKernelExitReason };

export interface StudioArchiveEntry {
  slug: string;
  savedAt: string;
  sizeBytes: number;
}
