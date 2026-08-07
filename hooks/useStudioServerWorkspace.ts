"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createServerWorkspaceController,
  pickDefaultWorkspaceFile,
  type StudioServerWorkspaceController,
  type StudioServerWorkspaceState,
} from "@/lib/studio/serverWorkspace";

export interface UseStudioServerWorkspaceResult {
  state: StudioServerWorkspaceState;
  controller: StudioServerWorkspaceController;
  bootstrap: () => Promise<void>;
}

// Hook fino: toda a lógica vive no controller puro (testado em node);
// aqui só a ponte React via useSyncExternalStore e o boot do modo servidor.
export function useStudioServerWorkspace(): UseStudioServerWorkspaceResult {
  const [controller] = useState(() => createServerWorkspaceController());

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );

  useEffect(() => {
    void controller.refreshStatus();
    // Sem dispose no unmount: um autosave em voo precisa concluir para não
    // perder edição; o controller solto é coletado junto com o componente.
    return () => {
      void controller.flushAutosave();
    };
  }, [controller]);

  const bootstrap = useCallback(async () => {
    await controller.loadTree();
    const current = controller.getState();
    if (current.activeFilePath) return;
    const target = pickDefaultWorkspaceFile(current.tree);
    if (target) await controller.openFile(target);
  }, [controller]);

  return { state, controller, bootstrap };
}
