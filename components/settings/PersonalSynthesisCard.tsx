"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SummaryState {
  status: "ready" | "pending" | "failed"; summary: string; generatedAt: string | null;
  originalChars: number; summaryChars: number; error: string | null;
  items: Array<{ text: string; sourceIds: string[] }>;
}

export function PersonalSynthesisCard() {
  const client = useQueryClient();
  const query = useQuery<SummaryState>({
    queryKey: ["personal-synthesis"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/memory/personal"), { cache: "no-store" });
      if (!response.ok) throw new Error("Não consegui consultar a síntese.");
      return response.json();
    },
    refetchInterval: 4000,
  });
  const regenerate = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiUrl("/api/memory/personal"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerate: true }) });
      if (!response.ok) throw new Error("Não consegui solicitar a atualização.");
    },
    onSuccess: () => {
      client.setQueryData<SummaryState>(["personal-synthesis"], current => current ? { ...current, status: "pending" } : current);
      void client.invalidateQueries({ queryKey: ["personal-synthesis"] });
    },
  });
  const state = query.data;
  return (
    <section className="gc-refined-soft-surface space-y-3 rounded-2xl border p-3" aria-label="Síntese pessoal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Síntese pessoal</h3>
        <span className="text-xs text-muted-foreground" role="status">{query.isError ? "Consulta indisponível" : !state ? "Carregando…" : state.status === "ready" ? "Atualizada" : state.status === "failed" ? "Falhou" : "Atualizando…"}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">O essencial acompanha cada mensagem. Os originais continuam editáveis e os detalhes são recuperados quando necessários. Enquanto a síntese não estiver pronta, o chat usa os originais atuais.</p>
      {state ? <p className="text-xs text-muted-foreground">Originais: {state.originalChars.toLocaleString("pt-BR")} caracteres · Síntese: {state.summaryChars.toLocaleString("pt-BR")} caracteres</p> : null}
      {state?.generatedAt ? <p className="text-xs text-muted-foreground">Última atualização: {new Date(state.generatedAt).toLocaleString("pt-BR")}</p> : null}
      {state?.summary ? <details><summary className="cursor-pointer text-xs font-medium">Ver síntese usada pelo Chat</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{state.summary}</p></details> : null}
      {state?.error || query.error || regenerate.error ? <p role="alert" className="text-xs text-destructive">{state?.error || query.error?.message || regenerate.error?.message}</p> : null}
      <Button type="button" size="sm" variant="outline" disabled={regenerate.isPending || state?.status === "pending"} onClick={() => regenerate.mutate()}>Atualizar síntese</Button>
    </section>
  );
}
