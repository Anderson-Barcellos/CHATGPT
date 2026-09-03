import styles from "./SoundCase.module.css";

export function GenerationWave({ ratio, status, label }: {
  ratio: number;
  status: "active" | "settled";
  label: string;
}) {
  const bounded = Math.max(0, Math.min(1, ratio));
  return (
    <div className={styles.waveRegion} data-status={status} aria-hidden={status === "settled"}>
      <div className={styles.waveMotion} style={{ transform: `translateY(${Math.round((1 - bounded) * 44)}px)` }}>
        <i /><i /><i />
      </div>
      <p aria-live="polite"><span aria-hidden="true">▥</span>{label} · {Math.round(bounded * 100)}%</p>
    </div>
  );
}
