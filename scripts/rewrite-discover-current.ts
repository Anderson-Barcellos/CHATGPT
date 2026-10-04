import { rewriteDiscoverArticles } from "../lib/discover/curator";
import {
  claimDiscoverJob,
  finishDiscoverJob,
  finishDiscoverRewrite,
  readDiscoverState,
} from "../lib/discover/store";

interface Options {
  apply: boolean;
  expectedCount: number | null;
}

function parseArgs(args: string[]): Options {
  let apply = false;
  let expectedCount: number | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--expected-count") {
      const value = args[index + 1];
      if (!value || !/^\d+$/.test(value)) throw new Error("--expected-count exige um inteiro.");
      expectedCount = Number(value);
      index += 1;
      continue;
    }
    throw new Error(`Argumento desconhecido: ${argument}`);
  }
  if (apply && expectedCount === null) throw new Error("--apply exige --expected-count.");
  return { apply, expectedCount };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const initial = await readDiscoverState();
  if (options.expectedCount !== null && initial.articles.length !== options.expectedCount)
    throw new Error(`Quantidade inesperada de matérias: esperadas ${options.expectedCount}, encontradas ${initial.articles.length}.`);
  if (!options.apply) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, articleCount: initial.articles.length })}\n`);
    return;
  }

  const claim = await claimDiscoverJob("rewrite");
  if (claim !== "started") throw new Error(`Reescrita não iniciada: ${claim}.`);
  try {
    const claimed = await readDiscoverState();
    if (claimed.articles.length !== options.expectedCount)
      throw new Error(`O feed mudou antes da reescrita: encontradas ${claimed.articles.length} matérias.`);
    const rewritten = await rewriteDiscoverArticles(claimed.articles);
    const backupPath = await finishDiscoverRewrite(rewritten);
    process.stdout.write(`${JSON.stringify({ dryRun: false, articleCount: rewritten.length, backupPath })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao reescrever as matérias.";
    await finishDiscoverJob({ error: message }).catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Falha ao reescrever as matérias.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
