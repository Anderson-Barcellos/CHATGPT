import type { SoundCasePublicVersion, SoundCaseVersionStatus, SoundCaseVersionSummary } from "@/lib/soundcase/types";

const ACTIVE = new Set<SoundCaseVersionStatus>([
  "queued", "directing", "synthesizing", "assembling", "audio_ready",
]);

export interface SoundCaseProgressView {
  ratio: number;
  label: string;
  animated: boolean;
}

export function isActiveSoundCaseStatus(status: SoundCaseVersionStatus): boolean {
  return ACTIVE.has(status);
}

export function getSoundCasePollInterval(version: SoundCasePublicVersion | null): 1500 | false {
  return version && isActiveSoundCaseStatus(version.status) ? 1500 : false;
}

function labelFor(status: SoundCaseVersionStatus): string {
  switch (status) {
    case "queued": return "Preparando a leitura";
    case "directing": return "Luna está dirigindo a narração";
    case "synthesizing": return "Construindo a voz";
    case "assembling": return "Montando o arquivo final";
    case "audio_ready": return "Finalizando a capa";
    case "ready": return "SoundCase pronto";
    case "interrupted": return "Geração interrompida";
    case "canceled": return "Geração cancelada";
    case "failed": return "Não foi possível concluir";
  }
}

type SoundCaseVersionLike = Pick<SoundCaseVersionSummary, "id" | "status" | "progress" | "audio">;

function ratioFor(version: Pick<SoundCaseVersionLike, "status" | "progress">): number {
  const persisted = Math.min(1, Math.max(0, version.progress.ratio));
  let ratio = persisted;
  if (version.status === "queued") ratio = Math.max(ratio, 0.03);
  if (version.status === "directing") ratio = Math.max(ratio, 0.08);
  if (version.status === "synthesizing") {
    const total = Math.max(1, version.progress.totalChunks);
    ratio = Math.max(ratio, 0.12 + (version.progress.completedChunks / total) * 0.7);
  }
  if (version.status === "assembling") ratio = Math.max(ratio, 0.88);
  if (version.status === "audio_ready") ratio = Math.max(ratio, 0.96);
  if (version.status === "ready") ratio = 1;
  return Math.min(1, ratio);
}

export function getSoundCaseProgress(version: SoundCasePublicVersion): SoundCaseProgressView {
  return { ratio: ratioFor(version), label: labelFor(version.status), animated: isActiveSoundCaseStatus(version.status) };
}

/** Tom que a interface usa para cor e ação: `partial` é áudio pronto com capa ainda em curso. */
export type SoundCaseVersionTone = "active" | "ready" | "partial" | "stopped" | "failed";

export interface SoundCaseVersionView {
  tone: SoundCaseVersionTone;
  label: string;
  ratio: number;
  playable: boolean;
}

/**
 * Contrato único entre o estado que o backend devolve e o que acervo, editor e player
 * mostram. Nunca vaza o status cru; `audio_ready` conta como tocável.
 */
export function describeSoundCaseVersion(version: SoundCaseVersionLike): SoundCaseVersionView {
  const playable = version.audio.status === "ready";
  const ratio = ratioFor(version);
  switch (version.status) {
    case "synthesizing":
      return { tone: "active", ratio, playable, label: `${labelFor(version.status)} · ${version.progress.completedChunks}/${Math.max(1, version.progress.totalChunks)}` };
    case "queued":
    case "directing":
    case "assembling":
      return { tone: "active", ratio, playable, label: labelFor(version.status) };
    case "audio_ready":
      return { tone: "partial", ratio, playable, label: "Áudio pronto · capa em curso" };
    case "ready":
      return { tone: "ready", ratio, playable, label: "Pronto" };
    case "interrupted":
      return { tone: "stopped", ratio, playable, label: "Interrompido" };
    case "canceled":
      return { tone: "stopped", ratio, playable, label: "Cancelado" };
    case "failed":
      return { tone: "failed", ratio, playable, label: "Falhou" };
  }
}

/** O acervo só congela se ninguém observar; outra versão ativa que não a selecionada pede refresh do projeto. */
export function getSoundCaseProjectPollInterval(
  versions: ReadonlyArray<Pick<SoundCaseVersionLike, "id" | "status">>,
  selectedVersionId: string | null
): 4000 | false {
  const hasOtherActive = versions.some((version) => version.id !== selectedVersionId && isActiveSoundCaseStatus(version.status));
  return hasOtherActive ? 4000 : false;
}
