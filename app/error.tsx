"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

const CHUNK_RELOAD_KEY = "gpt:chunk-reload-attempted";

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /chunkloaderror|failed to load chunk/i.test(error.message)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleChunk = isChunkLoadError(error);

  useEffect(() => {
    console.error("[GPT Error Boundary]", error);

    if (!isStaleChunk) return;

    const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
    if (alreadyRetried) return;

    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  }, [error, isStaleChunk]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">
          {isStaleChunk ? "Atualizando a versao do chat" : "Algo deu errado"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {isStaleChunk
            ? "O navegador tentou abrir um arquivo antigo da interface. Recarrega a pagina para buscar a versao atual."
            : error.message || "Ocorreu um erro inesperado."}
        </p>
        {error.digest && (
          <code className="text-nano text-muted-foreground/50">
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
