const MAX_TRANSCRIPTION_FILE_SIZE = 25 * 1024 * 1024;

export type TranscriptionFileValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function validateTranscriptionFile(
  file: File
): TranscriptionFileValidationResult {
  if (file.size === 0) {
    return {
      ok: false,
      status: 400,
      error: "O audio chegou vazio para transcricao.",
    };
  }

  if (!file.type.startsWith("audio/")) {
    return {
      ok: false,
      status: 400,
      error: "Formato de audio nao suportado.",
    };
  }

  if (file.size > MAX_TRANSCRIPTION_FILE_SIZE) {
    return {
      ok: false,
      status: 413,
      error: "Arquivo de audio muito grande. O limite e 25MB.",
    };
  }

  return { ok: true };
}
