import { claimDiscoverJob, finishDiscoverJob, readDiscoverState, type DiscoverClaim } from "./store";
import { curateDiscoverArticles } from "./curator";

export async function runDiscover(kind: "daily" | "manual"): Promise<DiscoverClaim> {
  const claim = await claimDiscoverJob(kind);
  if (claim !== "started") return claim;
  const work = async () => {
    try {
      const state = await readDiscoverState();
      const articles = await curateDiscoverArticles(state.topics, state.articles);
      await finishDiscoverJob({ articles });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar notícias.";
      console.error("[discover] Curadoria falhou:", message);
      await finishDiscoverJob({ error: message });
    }
  };
  if (kind === "manual") void work().catch(() => console.error("[discover] Falha ao persistir o estado da curadoria."));
  else await work();
  return "started";
}
