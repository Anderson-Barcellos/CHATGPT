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
  | { type: "console"; level: "log" | "error"; text: string }
  | { type: "status"; status: StudioWorkspaceRunStatus; durationMs: number };

export interface StudioArchiveEntry {
  slug: string;
  savedAt: string;
  sizeBytes: number;
}
