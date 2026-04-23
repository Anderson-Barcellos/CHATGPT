"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatRecoveryStateProps {
  error?: string | null;
  isRecovering: boolean;
  onRetry: () => void;
}

export function ChatRecoveryState({
  error,
  isRecovering,
  onRetry,
}: ChatRecoveryStateProps) {
  const isError = Boolean(error);

  return (
    <div className="flex h-full flex-1 items-center justify-center px-4 py-6 md:px-8 md:py-10">
      <div
        className={cn(
          "w-full max-w-xl rounded-3xl border px-5 py-6 text-center shadow-[0_20px_80px_rgba(2,6,23,0.18)] backdrop-blur-xl md:px-8 md:py-8",
          isError
            ? "border-destructive/20 bg-destructive/5"
            : "border-white/10 bg-background/45"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-1 md:h-16 md:w-16",
            isError
              ? "bg-destructive/10 text-destructive ring-destructive/20"
              : "bg-cyan-500/10 text-cyan-400 ring-cyan-400/20"
          )}
        >
          {isRecovering ? (
            <LoaderCircle className="h-6 w-6 animate-spin md:h-7 md:w-7" />
          ) : (
            <AlertTriangle className="h-6 w-6 md:h-7 md:w-7" />
          )}
        </div>

        <h2 className="text-lg font-semibold tracking-tight md:text-xl">
          {isError ? "Nao consegui recuperar o chat" : "Preparando teu workspace"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-[15px]">
          {error ||
            "Estou carregando as conversas e preparando a sessao para tu continuar de onde parou."}
        </p>

        <div className="mt-5 flex justify-center">
          <Button
            onClick={onRetry}
            disabled={isRecovering}
            className="h-10 rounded-xl px-4"
            variant={isError ? "default" : "secondary"}
          >
            {isRecovering ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Recarregar conversas
          </Button>
        </div>
      </div>
    </div>
  );
}
