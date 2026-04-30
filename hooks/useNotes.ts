import { useNotesContext } from "@/components/workspace-v2/NotesProvider";

export function useNotes() {
  const { appendToNotes } = useNotesContext();
  return { appendToNotes };
}
