import { createHash } from "node:crypto";
import type { SoundCaseSegment } from "@/lib/soundcase/types";

export const SOUNDCASE_MAX_DURATION_SECONDS = 90 * 60;
export const SOUNDCASE_BASE_WORDS_PER_MINUTE = 150;
export const SOUNDCASE_DEFAULT_SEGMENT_MAX_CHARS = 3_200;

const MIN_SPEED = 0.25;
const MAX_SPEED = 4;

export class SoundCaseTextError extends Error {
  readonly code: "soundcase_duration_limit" | "soundcase_segment_limit";
  readonly estimatedDurationSeconds?: number;

  constructor(
    code: "soundcase_duration_limit" | "soundcase_segment_limit",
    options: { estimatedDurationSeconds?: number } = {}
  ) {
    super(code);
    this.name = "SoundCaseTextError";
    this.code = code;
    this.estimatedDurationSeconds = options.estimatedDurationSeconds;
  }
}

export function normalizeSoundCaseText(text: string): string {
  return text.replace(/\r\n?/gu, "\n");
}

export function countSoundCaseWords(text: string): number {
  const normalized = normalizeSoundCaseText(text).trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

function normalizeSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return speed === Number.POSITIVE_INFINITY ? MAX_SPEED : 1;
  }
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

export function estimateSoundCaseDuration(text: string, speed: number): number {
  const words = countSoundCaseWords(text);
  const safeSpeed = normalizeSpeed(speed);
  return Math.ceil(
    (words / SOUNDCASE_BASE_WORDS_PER_MINUTE / safeSpeed) * 60
  );
}

export function assertSoundCaseDuration(text: string, speed: number): number {
  const estimatedDurationSeconds = estimateSoundCaseDuration(text, speed);
  if (estimatedDurationSeconds > SOUNDCASE_MAX_DURATION_SECONDS) {
    throw new SoundCaseTextError("soundcase_duration_limit", {
      estimatedDurationSeconds,
    });
  }
  return estimatedDurationSeconds;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function findPreferredEnd(text: string, start: number, maxChars: number): number {
  const hardEnd = Math.min(text.length, start + maxChars);
  if (hardEnd === text.length) return hardEnd;

  const window = text.slice(start, hardEnd + 1);
  let sentenceEnd = -1;
  for (const match of window.matchAll(/[.!?](?=\s|$)/gu)) {
    const candidate = (match.index ?? -1) + 1;
    if (candidate > 0 && candidate <= maxChars) sentenceEnd = candidate;
  }
  if (sentenceEnd > 0) return start + sentenceEnd;

  for (let index = Math.min(maxChars, window.length - 1); index > 0; index -= 1) {
    if (/\s/u.test(window[index])) return start + index;
  }

  return hardEnd;
}

function paragraphRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const separator = /\n[\t ]*\n+/gu;
  let cursor = 0;

  for (const match of text.matchAll(separator)) {
    const separatorStart = match.index ?? 0;
    ranges.push({ start: cursor, end: separatorStart });
    cursor = separatorStart + match[0].length;
  }
  ranges.push({ start: cursor, end: text.length });

  return ranges
    .map((range) => {
      let { start, end } = range;
      while (start < end && /\s/u.test(text[start])) start += 1;
      while (end > start && /\s/u.test(text[end - 1])) end -= 1;
      return { start, end };
    })
    .filter((range) => range.end > range.start);
}

export function segmentSoundCaseText(
  source: string,
  options: { maxChars?: number } = {}
): SoundCaseSegment[] {
  const text = normalizeSoundCaseText(source);
  const maxChars = options.maxChars ?? SOUNDCASE_DEFAULT_SEGMENT_MAX_CHARS;
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new SoundCaseTextError("soundcase_segment_limit");
  }

  const spans: Array<{ start: number; end: number }> = [];
  for (const paragraph of paragraphRanges(text)) {
    let cursor = paragraph.start;
    while (cursor < paragraph.end) {
      while (cursor < paragraph.end && /\s/u.test(text[cursor])) cursor += 1;
      if (cursor >= paragraph.end) break;

      let end = findPreferredEnd(
        text.slice(0, paragraph.end),
        cursor,
        maxChars
      );
      while (end > cursor && /\s/u.test(text[end - 1])) end -= 1;
      if (end <= cursor) end = Math.min(paragraph.end, cursor + maxChars);

      spans.push({ start: cursor, end });
      cursor = end;
    }
  }

  return spans.map(({ start, end }, index) => {
    const segmentText = text.slice(start, end);
    const textHash = sha256(segmentText);
    return {
      id: `${index}-${textHash.slice(0, 12)}`,
      index,
      start,
      end,
      text: segmentText,
      textHash,
    };
  });
}
