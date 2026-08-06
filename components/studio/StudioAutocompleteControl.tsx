import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import { cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

const STATUS_LABELS: Record<StudioAutocompleteStatus, string> = {
  idle: "Autocomplete ligado",
  requesting: "Autocomplete consultando",
  cooldown: "Autocomplete em espera",
  off: "Autocomplete desligado",
};

export function StudioAutocompleteControl({
  enabled,
  status,
  disabled = false,
  onToggle,
}: {
  enabled: boolean;
  status: StudioAutocompleteStatus;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const label = STATUS_LABELS[status];

  return (
    <button
      type="button"
      className={styles.autocompleteControl}
      aria-label={label}
      aria-pressed={enabled}
      disabled={disabled}
      title={label}
      onClick={() => onToggle(!enabled)}
    >
      <span
        aria-hidden="true"
        className={cn(
          styles.autocompleteDot,
          status === "requesting" && styles.autocompleteDotRequesting,
          status === "cooldown" && styles.autocompleteDotCooldown,
          status === "off" && styles.autocompleteDotOff
        )}
      />
      <span>Autocomplete</span>
    </button>
  );
}
