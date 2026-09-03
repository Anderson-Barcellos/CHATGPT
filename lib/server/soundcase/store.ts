import {
  countSoundCaseWords,
  estimateSoundCaseDuration,
  normalizeSoundCaseText,
} from "@/lib/soundcase/text";
import type {
  CreateSoundCaseProjectInput,
  SoundCaseImportMetadata,
  SoundCaseProject,
  SoundCaseProjectDetail,
  SoundCaseProjectMetadata,
  SoundCaseVersionSummary,
  UpdateSoundCaseProjectInput,
} from "@/lib/soundcase/types";
import {
  readJsonSafe,
  readTextSafe,
  removeProjectTree,
  resolveSoundCasePath,
  writeJsonDurable,
  writeTextDurable,
} from "@/lib/server/soundcase/files";

export const SOUNDCASE_MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_PROJECT_TITLE_CHARS = 120;
const INDEX_LOCK_KEY = "__soundcase_projects_index__";
const lockChains = new Map<string, Promise<void>>();

export type SoundCaseStoreErrorCode =
  | "soundcase_project_not_found"
  | "soundcase_revision_conflict"
  | "soundcase_import_type"
  | "soundcase_import_size"
  | "soundcase_import_encoding";

export class SoundCaseStoreError extends Error {
  readonly code: SoundCaseStoreErrorCode;
  readonly status: number;

  constructor(code: SoundCaseStoreErrorCode, status: number) {
    super(code);
    this.name = "SoundCaseStoreError";
    this.code = code;
    this.status = status;
  }
}

export interface SoundCaseTextImport {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

async function withStoreLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = lockChains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  lockChains.set(key, tail);
  await previous;

  try {
    return await fn();
  } finally {
    release();
    if (lockChains.get(key) === tail) lockChains.delete(key);
  }
}

function projectsIndexPath(): string {
  return resolveSoundCasePath("projects.json");
}

function projectMetadataPath(projectId: string): string {
  return resolveSoundCasePath("projects", projectId, "project.json");
}

function projectDraftPath(projectId: string): string {
  return resolveSoundCasePath("projects", projectId, "draft.txt");
}

function isSoundCaseProject(value: unknown): value is SoundCaseProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<SoundCaseProject>;
  return (
    typeof project.id === "string" &&
    typeof project.title === "string" &&
    typeof project.draftRevision === "number" &&
    (project.activeVersionId === null ||
      typeof project.activeVersionId === "string") &&
    typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string"
  );
}

async function readProjects(): Promise<SoundCaseProject[]> {
  const value = await readJsonSafe<unknown>(projectsIndexPath());
  if (value === null) return [];
  if (!Array.isArray(value) || value.some((item) => !isSoundCaseProject(item))) {
    throw new Error("soundcase_projects_index_invalid");
  }
  return value;
}

async function writeProjects(projects: SoundCaseProject[]): Promise<void> {
  await writeJsonDurable(projectsIndexPath(), projects);
}

async function readProjectMetadata(
  project: SoundCaseProject
): Promise<SoundCaseProjectMetadata> {
  const value = await readJsonSafe<SoundCaseProjectMetadata>(
    projectMetadataPath(project.id)
  );
  if (
    value &&
    value.project?.id === project.id &&
    Array.isArray(value.versions)
  ) {
    return value;
  }
  return { project, versions: [] };
}

async function writeProjectMetadata(
  project: SoundCaseProject,
  versions: SoundCaseVersionSummary[]
): Promise<void> {
  await writeJsonDurable(projectMetadataPath(project.id), { project, versions });
}

function normalizeTitle(title: string | undefined): string {
  const normalized = title?.trim().slice(0, MAX_PROJECT_TITLE_CHARS);
  return normalized || "Novo SoundCase";
}

function requireActiveProject(
  projects: SoundCaseProject[],
  projectId: string
): { project: SoundCaseProject; index: number } {
  const index = projects.findIndex(
    (candidate) => candidate.id === projectId && !candidate.deletedAt
  );
  if (index < 0) {
    throw new SoundCaseStoreError("soundcase_project_not_found", 404);
  }
  return { project: projects[index], index };
}

async function buildProjectDetail(
  project: SoundCaseProject,
  draftText?: string
): Promise<SoundCaseProjectDetail> {
  const text =
    draftText ?? (await readTextSafe(projectDraftPath(project.id)));
  if (text === null) {
    throw new SoundCaseStoreError("soundcase_project_not_found", 404);
  }
  return {
    ...project,
    draftText: text,
    draftWordCount: countSoundCaseWords(text),
    estimatedDurationSeconds: estimateSoundCaseDuration(text, 1),
    versions: (await readProjectMetadata(project)).versions,
  };
}

export async function listSoundCaseProjects(): Promise<SoundCaseProject[]> {
  const projects = await withStoreLock(INDEX_LOCK_KEY, readProjects);
  return projects
    .filter((project) => !project.deletedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createSoundCaseProject(
  input: CreateSoundCaseProjectInput = {}
): Promise<SoundCaseProject> {
  return withStoreLock(INDEX_LOCK_KEY, async () => {
    const projects = await readProjects();
    const now = new Date().toISOString();
    const project: SoundCaseProject = {
      id: crypto.randomUUID(),
      title: normalizeTitle(input.title),
      draftRevision: 0,
      activeVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const draftText = normalizeSoundCaseText(input.text ?? "");

    try {
      await writeTextDurable(projectDraftPath(project.id), draftText);
      await writeProjectMetadata(project, []);
      await writeProjects([project, ...projects]);
    } catch (error) {
      await removeProjectTree(project.id).catch(() => undefined);
      throw error;
    }
    return project;
  });
}

export async function getSoundCaseProject(
  projectId: string
): Promise<SoundCaseProjectDetail> {
  return withStoreLock(projectId, async () => {
    const project = await withStoreLock(INDEX_LOCK_KEY, async () => {
      const projects = await readProjects();
      return requireActiveProject(projects, projectId).project;
    });
    return buildProjectDetail(project);
  });
}

async function persistDraftMutation(
  projectId: string,
  input: Omit<UpdateSoundCaseProjectInput, "revision"> & { revision?: number },
  importMetadata?: SoundCaseImportMetadata
): Promise<SoundCaseProjectDetail> {
  const normalizedText = normalizeSoundCaseText(input.text);
  return withStoreLock(INDEX_LOCK_KEY, async () => {
    const projects = await readProjects();
    const { project, index } = requireActiveProject(projects, projectId);
    if (
      input.revision !== undefined &&
      input.revision !== project.draftRevision
    ) {
      throw new SoundCaseStoreError("soundcase_revision_conflict", 409);
    }

    const updated: SoundCaseProject = {
      ...project,
      title:
        input.title === undefined ? project.title : normalizeTitle(input.title),
      draftRevision: project.draftRevision + 1,
      ...(importMetadata ? { importMetadata } : {}),
      updatedAt: new Date().toISOString(),
    };
    projects[index] = updated;

    await writeTextDurable(projectDraftPath(projectId), normalizedText);
    await writeProjects(projects);
    const metadata = await readProjectMetadata(project);
    await writeProjectMetadata(updated, metadata.versions);
    return buildProjectDetail(updated, normalizedText);
  });
}

export async function saveSoundCaseDraft(
  projectId: string,
  input: UpdateSoundCaseProjectInput
): Promise<SoundCaseProjectDetail> {
  return withStoreLock(projectId, () =>
    persistDraftMutation(projectId, input)
  );
}

function parseImport(input: SoundCaseTextImport): {
  text: string;
  sourceType: "txt" | "md";
} {
  const extension = input.name.toLowerCase().match(/\.([^.]+)$/u)?.[1];
  const sourceType = extension === "txt" || extension === "md" ? extension : null;
  const validMime =
    input.mime === "text/plain" || input.mime === "text/markdown";
  if (!sourceType || !validMime) {
    throw new SoundCaseStoreError("soundcase_import_type", 415);
  }
  if (input.bytes.byteLength > SOUNDCASE_MAX_IMPORT_BYTES) {
    throw new SoundCaseStoreError("soundcase_import_size", 413);
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(input.bytes),
      sourceType,
    };
  } catch {
    throw new SoundCaseStoreError("soundcase_import_encoding", 400);
  }
}

export async function importSoundCaseText(
  projectId: string,
  input: SoundCaseTextImport
): Promise<SoundCaseProjectDetail> {
  const parsed = parseImport(input);
  return withStoreLock(projectId, () =>
    persistDraftMutation(
      projectId,
      { text: parsed.text },
      {
        sourceName: input.name.slice(0, 255),
        sourceType: parsed.sourceType,
        importedAt: new Date().toISOString(),
      }
    )
  );
}

export async function deleteSoundCaseProject(
  projectId: string
): Promise<void> {
  await withStoreLock(projectId, async () => {
    await withStoreLock(INDEX_LOCK_KEY, async () => {
      const projects = await readProjects();
      const index = projects.findIndex((project) => project.id === projectId);
      if (index < 0) {
        throw new SoundCaseStoreError("soundcase_project_not_found", 404);
      }
      const project = projects[index];
      if (project.deletedAt) return;
      const now = new Date().toISOString();
      const deleted: SoundCaseProject = {
        ...project,
        deletedAt: now,
        updatedAt: now,
      };
      projects[index] = deleted;
      await writeProjects(projects);
    });
    await removeProjectTree(projectId);
  });
}

export async function upsertSoundCaseVersionProjection(
  projectId: string,
  version: SoundCaseVersionSummary
): Promise<void> {
  await withStoreLock(projectId, async () => {
    await withStoreLock(INDEX_LOCK_KEY, async () => {
      const projects = await readProjects();
      const { project, index } = requireActiveProject(projects, projectId);
      const metadata = await readProjectMetadata(project);
      const versionIndex = metadata.versions.findIndex(
        (candidate) => candidate.id === version.id
      );
      const versions = [...metadata.versions];
      if (versionIndex >= 0) versions[versionIndex] = version;
      else versions.unshift(version);
      const updated: SoundCaseProject = {
        ...project,
        activeVersionId: version.id,
        updatedAt: version.createdAt > project.updatedAt
          ? version.createdAt
          : new Date().toISOString(),
      };
      projects[index] = updated;
      await writeProjects(projects);
      await writeProjectMetadata(updated, versions);
    });
  });
}

export async function removeSoundCaseVersionProjection(
  projectId: string,
  versionId: string,
  previousActiveVersionId: string | null
): Promise<void> {
  await withStoreLock(projectId, async () => {
    await withStoreLock(INDEX_LOCK_KEY, async () => {
      const projects = await readProjects();
      const { project, index } = requireActiveProject(projects, projectId);
      const metadata = await readProjectMetadata(project);
      const updated: SoundCaseProject = {
        ...project,
        activeVersionId: previousActiveVersionId,
        updatedAt: new Date().toISOString(),
      };
      projects[index] = updated;
      await writeProjects(projects);
      await writeProjectMetadata(
        updated,
        metadata.versions.filter((version) => version.id !== versionId)
      );
    });
  });
}
