import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import type { SoundCasePublicVersion } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

export function SoundCaseResult({ version, coverUrl }: { version: SoundCasePublicVersion; coverUrl: string }) {
  if (!version.direction) return null;
  const effective = version.effectiveSettings;
  return (
    <article className={styles.resultCard}>
      <div className={styles.coverFrame}>
        {version.cover.status === "ready" || version.cover.status === "fallback" ? <img src={coverUrl} alt="Capa gerada para este SoundCase" /> : <div className={styles.coverPending}><Sparkles /> Criando capa</div>}
      </div>
      <div className={styles.resultCopy}>
        <h2>{version.direction.title}</h2>
        <p>{version.summary || version.direction.summary}</p>
        <dl>
          <div><dt><Clock3 /> Duração</dt><dd>~{Math.max(1, Math.ceil(version.estimatedDurationSeconds / 60))} min</dd></div>
          <div><dt><Sparkles /> Voz</dt><dd>{effective?.voice.value ?? version.direction.voice}</dd></div>
          <div><dt><CalendarDays /> Criado</dt><dd>{new Date(version.createdAt).toLocaleDateString("pt-BR")}</dd></div>
        </dl>
      </div>
    </article>
  );
}
