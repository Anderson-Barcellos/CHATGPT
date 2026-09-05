// A jail do Studio (runner, terminal e kernel) nunca recebe a chave OpenAI
// principal do serviço: só a chave de escopo restrito STUDIO_OPENAI_API_KEY,
// que tem limite de gasto próprio. Sem ela, a jail fica sem chave alguma.

export function hasJailOpenAIKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.STUDIO_OPENAI_API_KEY?.trim());
}

export function buildJailParentEnv(
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const scoped = env.STUDIO_OPENAI_API_KEY?.trim();
  const parent: NodeJS.ProcessEnv = { ...env };
  delete parent.OPENAI_API_KEY;
  delete parent.STUDIO_OPENAI_API_KEY;
  if (scoped) parent.OPENAI_API_KEY = scoped;
  return parent;
}
