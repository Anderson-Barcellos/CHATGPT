import { useCommandPaletteContext } from "@/components/command/CommandPaletteProvider";

export function useCommandPalette() {
  return useCommandPaletteContext();
}
