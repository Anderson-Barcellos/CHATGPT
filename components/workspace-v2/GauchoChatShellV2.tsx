"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ChatRecoveryState } from "@/components/chat/ChatRecoveryState";
import { SplashScreen } from "@/components/ui/splash-screen";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { ChatCanvasV2 } from "@/components/workspace-v2/ChatCanvasV2";
import { CommandComposerContainerV2 } from "@/components/workspace-v2/CommandComposerContainerV2";
import { ContextPanelV2 } from "@/components/workspace-v2/ContextPanelV2";
import { ConversationRailV2 } from "@/components/workspace-v2/ConversationRailV2";
import { WorkspaceFrameV2 } from "@/components/workspace-v2/WorkspaceLayoutV2";
import { ExportDropdown } from "@/components/workspace-v2/ExportDropdown";
import { getReasoningLabel, isReasoningModel } from "@/lib/models/modelConfig";
import { useCostSync } from "@/hooks/useCostSync";
import type { ResponseMode } from "@/types";
import { useChat } from "@/hooks/useChat";
import { NotesProvider } from "@/components/workspace-v2/NotesProvider";
import { SelectionToolbar } from "@/components/chat/SelectionToolbar";
import { useTextSelection } from "@/hooks/useTextSelection";
import { CommandPaletteProvider } from "@/components/command/CommandPaletteProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { useConversations } from "@/hooks/useConversations";
import { useComponentPreloader } from "@/lib/performance/lazy";
import { MODELS } from "@/lib/models/modelConfig";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";

const CONTEXT_DOCKED_QUERY = "(min-width: 1280px)";

function subscribeContextDocked(callback: () => void) {
  const mql = window.matchMedia(CONTEXT_DOCKED_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getContextDockedSnapshot() {
  return window.matchMedia(CONTEXT_DOCKED_QUERY).matches;
}

function getContextDockedServerSnapshot() {
  return false;
}

export function GauchoChatShellV2() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>("default");
  const isMobile = useIsMobile();
  const isContextDocked = useSyncExternalStore(
    subscribeContextDocked,
    getContextDockedSnapshot,
    getContextDockedServerSnapshot
  );
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const showSplash =
    isHydrated &&
    !splashDismissed &&
    !window.sessionStorage.getItem("gpt-splash-shown");

  useComponentPreloader();
  const { activeConversationId, messages, setActiveConversationId } = useChatStore();
  const { conversations } = useConversations();
  const { parameters } = useSettingsStore();
  const textSelection = useTextSelection();
  useCostSync();
  const {
    messages: chatMessages,
    isLoading: isChatLoading,
    error: composerError,
    recoveryError,
    isRecovering,
    reloadConversations,
    sendMessage,
    editAndResend,
    deleteMessage,
    stopGeneration,
  } = useChat();

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    const conversation = conversations.find((item) => item.id === activeConversationId);
    return conversation
      ? { ...conversation, messages }
      : {
          id: activeConversationId,
          title: "Workspace",
          messages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
  }, [activeConversationId, conversations, messages]);

  const currentModel = MODELS[parameters.model];
  const reasoningLabel = isReasoningModel(parameters.model)
    ? getReasoningLabel(parameters.reasoningEffort)
    : "";
  const artifactCount = chatMessages.filter((m) => m.artifact).length;
  const shouldShowRecoveryState =
    Boolean(recoveryError) || isRecovering || !activeConversationId;
  const effectiveMobileContextOpen = mobileContextOpen;

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("gpt-splash-shown", "1");
    setSplashDismissed(true);
  }, []);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("gaucho:open-settings", handler);
    return () => window.removeEventListener("gaucho:open-settings", handler);
  }, []);

  useEffect(() => {
    const handler = () => setMobileContextOpen(false);
    window.addEventListener("gaucho:close-context-panel", handler);
    return () => window.removeEventListener("gaucho:close-context-panel", handler);
  }, []);

  useEffect(() => {
    const handler = () => setMobileContextOpen(true);
    window.addEventListener("gaucho:open-context-panel", handler);
    return () => window.removeEventListener("gaucho:open-context-panel", handler);
  }, []);

  const handleMobileContextOpenChange = useCallback(
    (open: boolean) => {
      setMobileContextOpen(open);
    },
    []
  );

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <CommandPaletteProvider
        onNewConversation={() => setActiveConversationId(null)}
        onOpenSettings={() => setSettingsOpen(true)}
      >
      <NotesProvider>
      <div>
        <WorkspaceFrameV2
          activeConversationTitle={activeConversation?.title || "Workspace"}
          currentModelName={currentModel?.name || parameters.model}
          activeResponseMode={responseMode}
          reasoningLabel={reasoningLabel}
          artifactCount={artifactCount}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarOpenChange={setMobileSidebarOpen}
          sidebar={<ConversationRailV2 onOpenSettings={() => setSettingsOpen(true)} />}
          tabletSidebar={
            <ConversationRailV2
              compact
              onOpenSettings={() => setSettingsOpen(true)}
              onClose={() => setMobileSidebarOpen(true)}
            />
          }
          mobileSidebar={
            <ConversationRailV2
              onOpenSettings={() => setSettingsOpen(true)}
              onClose={() => setMobileSidebarOpen(false)}
            />}
          chat={
            shouldShowRecoveryState ? (
              <ChatRecoveryState
                error={recoveryError}
                isRecovering={isRecovering}
                onRetry={() => {
                  void reloadConversations();
                }}
              />
            ) : (
              <ChatCanvasV2
                messages={chatMessages}
                isLoading={isChatLoading}
                editAndResend={editAndResend}
                deleteMessage={deleteMessage}
              />
            )
          }
          composer={
            shouldShowRecoveryState ? null : (
              <CommandComposerContainerV2
                sendMessage={sendMessage}
                stopGeneration={stopGeneration}
                isLoading={isChatLoading}
                error={composerError}
                responseMode={responseMode}
                onResponseModeChange={setResponseMode}
              />
            )
          }
          contextPanel={<ContextPanelV2 />}
          mobileContextPanel={<ContextPanelV2 />}
          mobileContextOpen={effectiveMobileContextOpen}
          onMobileContextOpenChange={handleMobileContextOpenChange}
          onOpenSettings={() => setSettingsOpen(true)}
          exportControl={<ExportDropdown />}
        />
      </div>
        <SelectionToolbar selection={textSelection} />
      </NotesProvider>
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CommandPalette />
      </CommandPaletteProvider>
    </>
  );
}
