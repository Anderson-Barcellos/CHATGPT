import type { TtsAudioFormat } from "@/types";
import type { TtsVoice } from "@/lib/tts/speechText";

export const SOUNDCASE_DEFAULT_AUDIO_FORMAT = "mp3" satisfies TtsAudioFormat;
export const SOUNDCASE_AUDIO_FORMAT_OVERRIDES = ["flac", "wav"] as const satisfies readonly TtsAudioFormat[];
export const SOUNDCASE_INTERMEDIATE_AUDIO_FORMAT = "flac" satisfies TtsAudioFormat;

export type SoundCasePlaybackMode = "realtime" | "silent";
export type SoundCaseChoiceSource = "automatic" | "override" | "fallback";

export type SoundCaseVersionStatus =
  | "queued"
  | "directing"
  | "synthesizing"
  | "assembling"
  | "audio_ready"
  | "ready"
  | "interrupted"
  | "canceled"
  | "failed";

export type SoundCaseJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "interrupted"
  | "canceled"
  | "failed";

export type SoundCaseChunkStatus =
  | "pending"
  | "synthesizing"
  | "completed"
  | "failed";

export interface SoundCaseSegment {
  id: string;
  index: number;
  start: number;
  end: number;
  text: string;
  textHash: string;
}

export interface SoundCasePronunciation {
  term: string;
  pronunciation: string;
}

export interface SoundCaseSegmentDirection {
  segmentId: string;
  instructions: string;
}

export interface SoundCaseDirection {
  model: "gpt-5.6-luna";
  promptVersion: string;
  source: "automatic" | "fallback";
  title: string;
  summary: string;
  language: string;
  voice: TtsVoice;
  speed: number;
  globalInstructions: string;
  pronunciations: SoundCasePronunciation[];
  segmentDirections: SoundCaseSegmentDirection[];
  coverPrompt: string;
}

export interface SoundCaseGenerationSettings {
  automatic: boolean;
  playbackMode: SoundCasePlaybackMode;
  format: TtsAudioFormat;
  voiceOverride: TtsVoice | null;
  speedOverride: number | null;
  instructionsOverride: string | null;
}

export interface SoundCaseEffectiveChoice<T> {
  value: T;
  source: SoundCaseChoiceSource;
}

export interface SoundCaseEffectiveSettings {
  format: SoundCaseEffectiveChoice<TtsAudioFormat>;
  voice: SoundCaseEffectiveChoice<TtsVoice>;
  speed: SoundCaseEffectiveChoice<number>;
  instructions: SoundCaseEffectiveChoice<string>;
}

export interface SoundCaseImportMetadata {
  sourceName: string;
  sourceType: "txt" | "md";
  importedAt: string;
}

export interface SoundCaseProject {
  id: string;
  title: string;
  draftRevision: number;
  activeVersionId: string | null;
  importMetadata?: SoundCaseImportMetadata;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SoundCaseChunk {
  id: string;
  index: number;
  segmentId: string;
  start: number;
  end: number;
  textHash: string;
  status: SoundCaseChunkStatus;
  attempts: number;
  fileName?: string;
  durationSeconds?: number;
  byteLength?: number;
  contentHash?: string;
  errorCode?: string;
}

export interface SoundCaseManifest {
  versionId: string;
  sourceHash: string;
  format: TtsAudioFormat;
  totalChunks: number;
  completedChunks: number;
  chunks: SoundCaseChunk[];
  createdAt: string;
  updatedAt: string;
}

export interface SoundCaseProgress {
  phase: SoundCaseVersionStatus;
  ratio: number;
  completedChunks: number;
  totalChunks: number;
  updatedAt: string;
}

export interface SoundCaseAudioPending {
  status: "pending";
  format: TtsAudioFormat;
}

export interface SoundCaseAudioReady {
  status: "ready";
  format: TtsAudioFormat;
  durationSeconds: number;
  contentType: string;
  fileName: string;
}

export type SoundCaseAudio = SoundCaseAudioPending | SoundCaseAudioReady;

export interface SoundCaseCoverPending {
  status: "pending";
}

export interface SoundCaseCoverReady {
  status: "ready" | "fallback";
  contentType: "image/png" | "image/svg+xml";
  fileName: string;
}

export type SoundCaseCover = SoundCaseCoverPending | SoundCaseCoverReady;

export interface SoundCasePublicError {
  code: string;
  message: string;
  diagnosticId?: string;
}

export interface SoundCaseVersion {
  id: string;
  projectId: string;
  status: SoundCaseVersionStatus;
  sourceHash: string;
  settingsHash: string;
  idempotencyKey: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  segments: SoundCaseSegment[];
  requestedSettings: SoundCaseGenerationSettings;
  effectiveSettings: SoundCaseEffectiveSettings | null;
  direction: SoundCaseDirection | null;
  manifest: SoundCaseManifest;
  progress: SoundCaseProgress;
  audio: SoundCaseAudio;
  cover: SoundCaseCover;
  summary: string | null;
  createdAt: string;
  completedAt?: string;
  error?: SoundCasePublicError;
}

export interface SoundCaseVersionSummary {
  id: string;
  projectId: string;
  idempotencyKey: string;
  status: SoundCaseVersionStatus;
  title: string;
  summary: string | null;
  wordCount: number;
  estimatedDurationSeconds: number;
  requestedFormat: TtsAudioFormat;
  audio: SoundCaseAudio;
  cover: SoundCaseCover;
  progress: SoundCaseProgress;
  createdAt: string;
  completedAt?: string;
}

export interface SoundCaseProjectDetail extends SoundCaseProject {
  draftText: string;
  draftWordCount: number;
  estimatedDurationSeconds: number;
  versions: SoundCaseVersionSummary[];
}

export interface SoundCaseJob {
  id: string;
  projectId: string;
  versionId: string;
  status: SoundCaseJobStatus;
  revision: number;
  attempt: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  lastErrorCode?: string;
}

export type SoundCaseVersionMetadata = Omit<SoundCaseVersion, "manifest">;

export interface SoundCaseProjectMetadata {
  project: SoundCaseProject;
  versions: SoundCaseVersionSummary[];
}

export interface SoundCaseLeaseGuard {
  jobId: string;
  workerId: string;
  expectedRevision: number;
}

export interface SoundCaseClaimedJob extends SoundCaseJob {
  version: SoundCaseVersion;
  manifest: SoundCaseManifest;
}

export interface UpdateSoundCaseChunkInput extends SoundCaseLeaseGuard {
  chunkId: string;
  status: SoundCaseChunkStatus;
  fileName?: string;
  durationSeconds?: number;
  byteLength?: number;
  contentHash?: string;
  errorCode?: string;
}

export interface CreateSoundCaseProjectInput {
  title?: string;
  text?: string;
}

export interface UpdateSoundCaseProjectInput {
  text: string;
  revision: number;
  title?: string;
}

export interface CreateSoundCaseVersionInput {
  settings: SoundCaseGenerationSettings;
}

export interface CreateSoundCaseVersionResult {
  version: SoundCaseVersion;
  created: boolean;
}

export interface SoundCaseProjectListResponse {
  projects: SoundCaseProject[];
}

export interface SoundCaseProjectResponse {
  project: SoundCaseProjectDetail;
}

export interface SoundCaseVersionResponse {
  version: SoundCaseVersion;
}

export interface SoundCaseActionResponse {
  projectId: string;
  versionId: string;
  status: SoundCaseVersionStatus;
}

export interface SoundCaseApiErrorResponse {
  error: string;
  message?: string;
  code?: string;
  diagnosticId?: string;
}
