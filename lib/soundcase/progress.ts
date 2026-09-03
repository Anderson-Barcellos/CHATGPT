import type { SoundCasePublicVersion, SoundCaseVersionStatus } from "@/lib/soundcase/types";

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

export function getSoundCaseProgress(version: SoundCasePublicVersion): SoundCaseProgressView {
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
  return { ratio: Math.min(1, ratio), label: labelFor(version.status), animated: isActiveSoundCaseStatus(version.status) };
}
