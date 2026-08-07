export const STUDIO_AUTOCOMPLETE_MAX_CONTEXT = 32_000;
export const STUDIO_AUTOCOMPLETE_PREFIX_LIMIT = 24_000;
export const STUDIO_AUTOCOMPLETE_SUFFIX_LIMIT = 8_000;
export const STUDIO_AUTOCOMPLETE_DEBOUNCE_MS = 450;
export const STUDIO_AUTOCOMPLETE_TIMEOUT_MS = 8_000;
export const STUDIO_AUTOCOMPLETE_COOLDOWN_MS = 30_000;

export type StudioAutocompleteLanguage =
  | "typescript"
  | "javascript"
  | "python";
export type StudioAutocompleteFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "insufficient_system_resource";
export type StudioAutocompleteStatus =
  | "idle"
  | "requesting"
  | "cooldown"
  | "off";

export interface StudioAutocompleteRequest {
  filePath: string;
  language: StudioAutocompleteLanguage;
  prefix: string;
  suffix: string;
}

export interface StudioAutocompleteResponse {
  completion: string;
  finishReason: StudioAutocompleteFinishReason;
}

export function buildStudioAutocompleteContext(source: string, offset: number) {
  const cursor = Math.max(0, Math.min(offset, source.length));
  const prefix = source.slice(0, cursor);
  const suffix = source.slice(cursor);

  if (source.length <= STUDIO_AUTOCOMPLETE_MAX_CONTEXT) {
    return { prefix, suffix };
  }

  return {
    prefix: prefix.slice(-STUDIO_AUTOCOMPLETE_PREFIX_LIMIT),
    suffix: suffix.slice(0, STUDIO_AUTOCOMPLETE_SUFFIX_LIMIT),
  };
}

function hashContext(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function createStudioAutocompleteRequestKey(input: {
  uri: string;
  version: number;
  lineNumber: number;
  column: number;
  prefix: string;
  suffix: string;
}): string {
  return [
    input.uri,
    input.version,
    input.lineNumber,
    input.column,
    hashContext(`${input.prefix}\u0000${input.suffix}`),
  ].join(":");
}

export function isStudioAutocompleteEligible(input: {
  enabled: boolean;
  desktop: boolean;
  focused: boolean;
  selectionEmpty: boolean;
  composing: boolean;
  language: string;
}): boolean {
  return (
    input.enabled &&
    input.desktop &&
    input.focused &&
    input.selectionEmpty &&
    !input.composing &&
    (input.language === "typescript" ||
      input.language === "javascript" ||
      input.language === "python")
  );
}

export function normalizeStudioAutocompleteCompletion(
  completion: string,
  finishReason: StudioAutocompleteFinishReason,
  atLineEnd: boolean
): string | null {
  if (
    finishReason !== "stop" ||
    !completion.trim() ||
    completion.includes("```")
  ) {
    return null;
  }

  if (atLineEnd) return completion;

  return (
    completion.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null
  );
}

export class StudioAutocompleteFailureTracker {
  consecutiveFailures = 0;
  private cooldownUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  recordFailure(retryAfterSeconds?: number) {
    this.consecutiveFailures += 1;

    if (retryAfterSeconds && retryAfterSeconds > 0) {
      this.cooldownUntil = this.now() + retryAfterSeconds * 1_000;
    } else if (this.consecutiveFailures >= 3) {
      this.cooldownUntil = this.now() + STUDIO_AUTOCOMPLETE_COOLDOWN_MS;
    }
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.cooldownUntil = 0;
  }

  cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }

  isCoolingDown() {
    return this.cooldownRemainingMs() > 0;
  }
}
