import { Library, SlidersHorizontal, Sparkles } from "lucide-react";
import styles from "./SoundCase.module.css";

export function SoundCaseMobileDock({ onDirection, onLibrary, onGenerate, disabled }: {
  onDirection: () => void;
  onLibrary: () => void;
  onGenerate: () => void;
  disabled?: boolean;
}) {
  return (
    <nav className={styles.mobileDock} aria-label="Ações do SoundCase">
      <button type="button" onClick={onDirection}><SlidersHorizontal /> Direção</button>
      <button type="button" onClick={onLibrary}><Library /> Acervo</button>
      <button type="button" className={styles.mobileGenerate} disabled={disabled} onClick={onGenerate}><Sparkles /> Gerar</button>
    </nav>
  );
}
