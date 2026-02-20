"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GPT Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Algo deu errado</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "Ocorreu um erro inesperado."}
        </p>
        {error.digest && (
          <code className="text-[10px] text-muted-foreground/50">
            Digest: {error.digest}
          </code>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Recarregar pagina
        </Button>
      </div>
    </div>
  );
}