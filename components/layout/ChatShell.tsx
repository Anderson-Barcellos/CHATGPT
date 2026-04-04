"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { SidebarModern } from "@/components/sidebar/SidebarModern";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { InputArea } from "@/components/chat/InputArea";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Menu,
  ChevronRight,
  Settings,
} from "lucide-react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { SplashScreen } from "@/components/ui/splash-screen";
import { ExportMenu } from "@/components/chat/ExportMenu";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useConversations } from "@/hooks/useConversations";
import { useComponentPreloader } from "@/lib/performance/lazy";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import { MODELS } from "@/lib/models/modelConfig";

const MODE_CONFIG = {
  chat: { gradient: "from-cyan-500 to-blue-600" },
  image: { gradient: "from-violet-500 to-purple-600" },
} as const;

export function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const { activeMode } = useUIStore();
  useComponentPreloader();
  const { activeConversationId, messages } = useChatStore();
  const { parameters } = useSettingsStore();
  const { conversations } = useConversations();

  const activeConversation = useMemo(() => {
    if (!activeConversationId || messages.length === 0) return null;
    const conv = conversations.find((c) => c.id === activeConversationId);
    return conv
      ? { ...conv, messages }
      : {
          id: activeConversationId,
          title: "Conversa",
          messages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
  }, [activeConversationId, messages, conversations]);

  const [isMobile, setIsMobile] = useState(false);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const showSplash =
    isHydrated &&
    !splashDismissed &&
    !window.sessionStorage.getItem("gpt-splash-shown");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useSwipeGesture({
    enabled: isMobile,
    onSwipeRight: useCallback(() => setSidebarOpen(true), []),
    onSwipeLeft: useCallback(() => setSidebarOpen(false), []),
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height);
      document.documentElement.style.setProperty("--kb-offset", `${offset}px`);
    };
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      document.documentElement.style.setProperty("--kb-offset", "0px");
    };
  }, []);

  const currentMode = MODE_CONFIG[activeMode as keyof typeof MODE_CONFIG];
  const currentModel = MODELS[parameters.model];

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem("gpt-splash-shown", "1");
    setSplashDismissed(true);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div
        className={cn(
          "h-dvh overflow-hidden bg-deep-space text-foreground/90",
          (!isHydrated || showSplash) && "invisible"
        )}
      >
        <div
          className="flex w-full p-0 md:p-4 md:pb-[max(1rem,env(safe-area-inset-bottom))] transition-[height] duration-150"
          style={{ height: "calc(100dvh - var(--kb-offset, 0px))" }}
        >
          <div className="relative flex h-full w-full overflow-hidden rounded-none md:rounded-[28px] border-0 md:border md:border-white/10 bg-background/60 md:shadow-[0_20px_80px_rgba(2,6,23,0.25)] backdrop-blur-2xl">
            {!isMobile && (
              <aside
                className={cn(
                  "hidden md:flex transition-all duration-300 border-r border-white/5",
                  "glass",
                  sidebarCollapsed ? "w-16" : "w-72"
                )}
              >
                <div className="relative h-full w-full">
                  {sidebarCollapsed ? (
                    <div className="flex h-full flex-col items-center gap-4 py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSidebarCollapsed(false)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <GPTLogo size={36} />
                    </div>
                  ) : (
                    <SidebarModern
                      onOpenSettings={() => setSettingsOpen(true)}
                      onCollapse={() => setSidebarCollapsed(true)}
                    />
                  )}
                </div>
              </aside>
            )}

            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side="left" className="w-[82vw] max-w-sm p-0 glass">
                <SidebarModern
                  onOpenSettings={() => {
                    setSidebarOpen(false);
                    setSettingsOpen(true);
                  }}
                />
              </SheetContent>
            </Sheet>

            <div className="flex h-full flex-1 flex-col overflow-hidden">
              <header className="border-b border-white/5 bg-background/40 backdrop-blur-xl pt-[env(safe-area-inset-top)] md:pt-0">
                <div className="flex items-center justify-between px-2.5 py-1.5 md:px-4 md:py-2.5">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(true)}
                        className="h-8 w-8 rounded-xl"
                        data-compact-touch
                      >
                        <Menu className="h-4 w-4" />
                      </Button>
                    )}

                    <div className="flex items-center gap-2 md:gap-2.5">
                      <GPTLogo size={isMobile ? 22 : 26} />
                      <div className="leading-tight">
                        <div className="flex items-center gap-1">
                          <h1 className="text-[12px] font-semibold tracking-wide md:text-sm">
                            <span className="text-gradient-gpt">GPT</span>
                          </h1>
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                            title={currentModel?.name || parameters.model}
                          />
                        </div>
                        <p className="max-w-[130px] truncate text-[8px] uppercase tracking-[0.16em] text-muted-foreground/70 md:max-w-[320px] md:text-[10px] md:tracking-[0.18em]">
                          {activeConversation?.title || "Workspace"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 md:gap-1">
                    <ExportMenu conversation={activeConversation} size="icon" />

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSettingsOpen(true)}
                      className="h-8 w-8 rounded-xl"
                      data-compact-touch
                    >
                      <Settings className="h-4 w-4" />
                    </Button>

                    <ThemeToggle />
                  </div>
                </div>

                <div
                  className={cn(
                    "h-[2px] w-full opacity-50 transition-all bg-gradient-to-r",
                    currentMode.gradient
                  )}
                />
              </header>

              <main className="flex-1 overflow-hidden">
                <div className="flex h-full flex-col">
                  <ChatContainer />
                  <InputArea />
                </div>
              </main>
            </div>

            <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <ArtifactPanel />
          </div>
        </div>
      </div>
    </>
  );
}
