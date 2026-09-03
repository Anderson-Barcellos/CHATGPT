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
import type { Conversation, ResponseMode } from "@/types";
import { useChat } from "@/hooks/useChat";
import { NotesProvider } from "@/components/workspace-v2/NotesProvider";
import { SelectionToolbar } from "@/components/chat/SelectionToolbar";
import { useTextSelection } from "@/hooks/useTextSelection";
import { CommandPaletteProvider } from "@/components/command/CommandPaletteProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { useConversations } from "@/hooks/useConversations";
import { useComponentPreloader } from "@/lib/performance/lazy";
import { MODELS } from "@/lib/models/modelConfig";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { toast } from "sonner";

export function GauchoChatShellV2() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>("default");
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
  const { activeConversationId, messages, isStreaming, setActiveConversationId } = useChatStore();
  const { conversations, createConversation } = useConversations();
  const { parameters } = useSettingsStore();
  const {
    contextPanelOpen,
    setContextPanelOpen,
    closeContextPanel,
  } = useUIStore();
  const textSelection = useTextSelection();
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
  const recentConversations = useMemo<
    Pick<Conversation, "id" | "title" | "updatedAt">[]
  >(
    () =>
      [...conversations]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 4)
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
    [conversations]
  );
  const shouldShowRecoveryState =
    Boolean(recoveryError) || isRecovering || !activeConversationId;
  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("gpt-splash-shown", "1");
    setSplashDismissed(true);
  }, []);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("gaucho:open-settings", handler);
    return () => window.removeEventListener("gaucho:open-settings", handler);
  }, []);

  const handleNewConversation = useCallback(async () => {
    if (isStreaming) {
      toast.info("Aguarde a resposta terminar para abrir uma nova conversa.");
      return;
    }

    try {
      const id = await createConversation("Nova conversa");
      setActiveConversationId(id);
      setMobileSidebarOpen(false);
      closeContextPanel();
    } catch (creationError) {
      console.error("[GauchoChatShellV2] Falha ao criar conversa:", creationError);
      toast.error("Nao consegui abrir uma nova conversa agora.");
    }
  }, [closeContextPanel, createConversation, isStreaming, setActiveConversationId]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) {
        setMobileSidebarOpen(false);
        return;
      }
      if (isStreaming) {
        toast.info("Aguarde a resposta terminar para trocar de conversa.");
        return;
      }
      setActiveConversationId(id);
      setMobileSidebarOpen(false);
      closeContextPanel();
    },
    [activeConversationId, closeContextPanel, isStreaming, setActiveConversationId]
  );

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <CommandPaletteProvider
        onNewConversation={() => void handleNewConversation()}
        onOpenSettings={() => setSettingsOpen(true)}
      >
      <NotesProvider>
      <div>
        <WorkspaceFrameV2
          activeConversationTitle={activeConversation?.title || "Workspace"}
          currentModelName={currentModel?.name || parameters.model}
          onNewConversation={() => void handleNewConversation()}
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
                recentConversations={recentConversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onOpenConversations={() => setMobileSidebarOpen(true)}
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
          mobileContextOpen={contextPanelOpen}
          onMobileContextOpenChange={setContextPanelOpen}
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
