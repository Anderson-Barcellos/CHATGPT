# SoundCase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-on-demand:subagent-driven-development (recommended) or superpowers-on-demand:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/soundcase` como um workspace autenticado que dirige textos com Luna, inicia leitura Realtime e produz arquivos TTS duráveis, retomáveis e versionados.

**Architecture:** O frontend usa um shell isolado e APIs autenticadas. Metadados pequenos ficam em índices JSON atômicos e cada versão ocupa uma pasta privada; uma fila com lease é drenada por endpoint interno acionado por systemd path/timer. Realtime é efêmero no navegador, enquanto TTS, montagem FFmpeg e capa pertencem ao worker durável.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Vitest, OpenAI SDK 6.46, Responses API, Realtime WebRTC, `gpt-5.6-luna`, `gpt-4o-mini-tts`, GPT Image, FFmpeg/FFprobe, systemd, CSS Modules e componentes Radix existentes.

**Spec:** `docs/superpowers-on-demand/specs/2026-09-02-soundcase-design.md`

## Global Constraints

- Rota interna `/soundcase`; deployment público `/chat/soundcase` via `NEXT_PUBLIC_BASE_PATH=/chat`.
- Texto original é imutável dentro da versão e nunca pode ser reescrito pelo Luna.
- Modo automático usa `gpt-5.6-luna`; voz e moduladores aceitam override explícito.
- Realtime é efêmero e segmentado; TTS final é durável, retomável e independente da aba.
- MP3 é padrão; FLAC e WAV são overrides; intermediários duráveis usam FLAC.
- Limite estimado: 90 minutos por versão; smoke pago: aproximadamente 15 minutos.
- Entrada inicial: digitação, colagem, `.txt` e `.md`; PDF e DOCX ficam fora.
- Um job pesado por vez; concorrência TTS inicial igual a 2; ordem final vem do manifesto.
- Arquivos e texto são privados, autenticados e não aparecem em logs nem em diretórios estáticos.
- Não alterar comportamento global do Chat, Pulse ou Studio para acomodar o SoundCase.
- Preservar o WIP atual. Tratar como dependências somente leitura `lib/tts/speechText.ts`, `hooks/useRealtimeTtsLab.ts`, `components/workspace-v2/PulsePanelV2.tsx` e `lib/models/modelConfig.ts`, salvo conflito descoberto e registrado.
- Em docs já modificados (`.env.example`, `AGENTS.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/INFRASTRUCTURE.md`, `docs/MODELS.md`), reler o diff imediatamente antes de editar e fazer apenas acréscimos cirúrgicos.
- Cada commit deve usar `git add` com caminhos explícitos; nunca incluir mudanças preexistentes.

## File Map

### Domínio compartilhado

- `lib/soundcase/types.ts`: tipos serializáveis e estados públicos.
- `lib/soundcase/text.ts`: normalização de input, estimativa, limite e segmentação determinística.
- `lib/soundcase/api.ts`: cliente HTTP tipado do frontend.
- `lib/soundcase/progress.ts`: mapeamento de estado confirmado para onda/labels.

### Backend privado

- `lib/server/soundcase/files.ts`: paths seguros, escrita durável e assets privados.
- `lib/server/soundcase/store.ts`: projetos, drafts, versões e índices.
- `lib/server/soundcase/jobs.ts`: idempotência, fila, lease, cancelamento e retomada.
- `lib/server/soundcase/direction.ts`: schema e chamada Luna com fallback.
- `lib/server/soundcase/audio.ts`: síntese de chunks, FFmpeg, FFprobe e Range.
- `lib/server/soundcase/cover.ts`: capa GPT Image e fallback tipográfico.
- `lib/server/soundcase/worker.ts`: orquestração resumível de uma versão.
- `lib/server/realtimeCall.ts`: construção compartilhada da sessão Realtime.

### Rotas

- `app/soundcase/page.tsx`: gate autenticado e shell.
- `app/api/soundcase/projects/**`: CRUD, importação e versões.
- `app/api/soundcase/projects/**/audio/route.ts`: playback/download com Range.
- `app/api/soundcase/projects/**/cover/route.ts`: capa privada.
- `app/api/soundcase/realtime-call/route.ts`: SDP SoundCase.
- `app/api/soundcase/worker/run-next/route.ts`: consumidor interno tokenizado.

### Frontend

- `components/navigation/ProductNav.tsx`: navegação Chat, Studio e SoundCase.
- `components/soundcase/SoundCaseShell.tsx`: composição e coordenação.
- `components/soundcase/SoundCaseEditor.tsx`: folha, importação, autosave e estimativa.
- `components/soundcase/DirectionSidebar.tsx`: automático, recomendação e overrides.
- `components/soundcase/GenerationWave.tsx`: onda vinculada ao progresso real.
- `components/soundcase/SoundCaseLibrary.tsx`: projetos e versões.
- `components/soundcase/SoundCaseResult.tsx`: capa, resumo e metadados.
- `components/soundcase/SoundCasePlayer.tsx`: Realtime e arquivo final.
- `components/soundcase/SoundCaseMobileDock.tsx`: sheets e ação principal.
- `components/soundcase/SoundCase.module.css`: layout e visual responsivo.
- `hooks/useSoundCase.ts`: query, mutations, polling, autosave e reconciliação.
- `hooks/useSoundCaseRealtime.ts`: fila WebRTC segmentada.

### Operação e documentação

- `scripts/run-soundcase-worker.sh`: drena a fila interna.
- `systemd/chatgpt-soundcase.service`: oneshot.
- `systemd/chatgpt-soundcase.path`: acionamento imediato.
- `systemd/chatgpt-soundcase.timer`: recuperação periódica.
- `.gitignore`, `.env.example`, `/etc/apache2/APACHE.md` e docs do projeto: runtime e rotas.

---

### Task 1: Contratos, estimativa e segmentação determinística

**Files:**
- Create: `lib/soundcase/types.ts`
- Create: `lib/soundcase/text.ts`
- Test: `lib/soundcase/text.test.ts`

**Interfaces:**
- Consumes: `TtsAudioFormat` e vozes permitidas já existentes em `@/types` e `@/lib/tts/speechText`.
- Produces: `SoundCaseProject`, `SoundCaseVersion`, `SoundCaseJob`, `SoundCaseDirection`, `SoundCaseSegment`, `estimateSoundCaseDuration`, `assertSoundCaseDuration`, `segmentSoundCaseText`.

- [ ] **Step 1: Escrever testes que fixam preservação, IDs e teto**

```ts
it("segmenta sem perder a ordem do texto narravel", () => {
  const source = "Primeiro parágrafo. Ainda primeiro.\n\nSegundo parágrafo.";
  const segments = segmentSoundCaseText(source, { maxChars: 48 });
  expect(segments.map((item) => item.text).join("\n\n")).toBe(source);
  expect(segments.map((item) => item.index)).toEqual([0, 1]);
  expect(segments.every((item) => item.textHash.length === 64)).toBe(true);
});

it("rejeita estimativa acima de noventa minutos", () => {
  const source = Array.from({ length: 13_501 }, () => "palavra").join(" ");
  expect(() => assertSoundCaseDuration(source, 1)).toThrowError(
    expect.objectContaining({ code: "soundcase_duration_limit" })
  );
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha inicial**

Run: `npm test -- lib/soundcase/text.test.ts`

Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 3: Definir os contratos serializáveis**

```ts
export type SoundCaseVersionStatus =
  | "queued"
  | "directing"
  | "synthesizing"
  | "assembling"
  | "audio_ready"
  | "ready"
  | "interrupted"
  | "canceled"
  | "failed";

export interface SoundCaseSegment {
  id: string;
  index: number;
  start: number;
  end: number;
  text: string;
  textHash: string;
}

export interface SoundCaseDirection {
  model: "gpt-5.6-luna";
  promptVersion: string;
  source: "automatic" | "fallback";
  title: string;
  summary: string;
  language: string;
  voice: string;
  speed: number;
  globalInstructions: string;
  pronunciations: Array<{ term: string; pronunciation: string }>;
  segmentDirections: Array<{ segmentId: string; instructions: string }>;
  coverPrompt: string;
}
```

Definir no mesmo arquivo os tipos completos de projeto, detalhe de projeto, settings, versão, manifesto, chunk, job, erro público e payloads de API. Não usar `any`; campos opcionais só aparecem em fases onde realmente podem faltar.

- [ ] **Step 4: Implementar estimativa e segmentação com offsets reais**

```ts
export const SOUNDCASE_MAX_DURATION_SECONDS = 90 * 60;
export const SOUNDCASE_BASE_WORDS_PER_MINUTE = 150;

export function estimateSoundCaseDuration(text: string, speed: number): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  const safeSpeed = Math.min(4, Math.max(0.25, speed));
  return Math.ceil((words / SOUNDCASE_BASE_WORDS_PER_MINUTE / safeSpeed) * 60);
}
```

Segmentar primeiro em blocos separados por linhas em branco, depois em sentenças, e por último em espaços quando um trecho exceder `maxChars`. Calcular `start` e `end` contra o texto normalizado uma única vez; `textHash` usa SHA-256 e `id` usa `${index}-${hash.slice(0, 12)}`.

- [ ] **Step 5: Rodar testes, typecheck e commit**

Run: `npm test -- lib/soundcase/text.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add lib/soundcase/types.ts lib/soundcase/text.ts lib/soundcase/text.test.ts
git commit -m "feat(soundcase): define text and version contracts"
```

### Task 2: Filesystem privado e escrita durável

**Files:**
- Create: `lib/server/soundcase/files.ts`
- Test: `lib/server/soundcase/files.test.ts`

**Interfaces:**
- Consumes: IDs opacos produzidos pelo domínio.
- Produces: `getSoundCaseRoot`, `resolveSoundCasePath`, `writeTextDurable`, `writeJsonDurable`, `readJsonSafe`, `removeVersionTree`, `assertRegularSoundCaseFile`.

- [ ] **Step 1: Escrever testes em diretório temporário**

```ts
it("recusa traversal e symlink final", async () => {
  expect(() => resolveSoundCasePath("projects", "../segredo")).toThrow(
    "soundcase_path_invalid"
  );
  await fs.symlink(outsidePath, path.join(root, "escape"));
  await expect(assertRegularSoundCaseFile(path.join(root, "escape"))).rejects.toThrow(
    "soundcase_symlink_rejected"
  );
});

it("promove json duravel sem deixar temporario", async () => {
  await writeJsonDurable(target, { revision: 2 });
  await expect(readJsonSafe(target)).resolves.toEqual({ revision: 2 });
  await expect(fs.access(`${target}.tmp`)).rejects.toThrow();
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- lib/server/soundcase/files.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar raiz injetável e resolução segura**

```ts
const DEFAULT_ROOT = path.join(process.cwd(), "data", "soundcase");

export function getSoundCaseRoot(): string {
  return process.env.SOUNDCASE_DATA_DIR?.trim() || DEFAULT_ROOT;
}

export function resolveSoundCasePath(...segments: string[]): string {
  if (segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  const root = path.resolve(getSoundCaseRoot());
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new SoundCaseFileError("soundcase_path_invalid");
  }
  return resolved;
}
```

`writeTextDurable` deve abrir o `.tmp` com modo `0o600`, gravar, chamar `file.sync()`, fechar, renomear e sincronizar o diretório pai. `assertRegularSoundCaseFile` usa `lstat` e rejeita link simbólico.

- [ ] **Step 4: Rodar testes e commit**

Run: `npm test -- lib/server/soundcase/files.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add lib/server/soundcase/files.ts lib/server/soundcase/files.test.ts
git commit -m "feat(soundcase): add private durable storage"
```

### Task 3: Store de projetos, rascunhos e importação

**Files:**
- Create: `lib/server/soundcase/store.ts`
- Test: `lib/server/soundcase/store.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `writeJsonDurable`, `writeTextDurable`, `resolveSoundCasePath`, tipos da Task 1.
- Produces: `listSoundCaseProjects`, `createSoundCaseProject`, `getSoundCaseProject`, `saveSoundCaseDraft`, `importSoundCaseText`, `deleteSoundCaseProject`.

- [ ] **Step 1: Fixar CAS de rascunho e validação de importação**

```ts
it("recusa autosave com revision antiga", async () => {
  const project = await createSoundCaseProject({ title: "Ensaio" });
  await saveSoundCaseDraft(project.id, { text: "versão dois", revision: 0 });
  await expect(
    saveSoundCaseDraft(project.id, { text: "escrita atrasada", revision: 0 })
  ).rejects.toMatchObject({ code: "soundcase_revision_conflict", status: 409 });
});

it.each(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"])(
  "recusa mime fora do contrato: %s",
  async (mime) => {
    const project = await createSoundCaseProject({ title: "Importação" });
    const bytes = new TextEncoder().encode("conteúdo inválido para este MIME");
    await expect(importSoundCaseText(project.id, { name: "entrada.bin", mime, bytes })).rejects.toMatchObject({ code: "soundcase_import_type" });
  }
);
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- lib/server/soundcase/store.test.ts`

Expected: FAIL por funções ausentes.

- [ ] **Step 3: Implementar índices e locks por projeto**

Usar um `Map<string, Promise<void>>` privado para serializar mutações por projeto. `projects.json` guarda somente metadados; `draft.txt` guarda conteúdo. `saveSoundCaseDraft` exige igualdade entre `input.revision` e `project.draftRevision`, incrementa uma vez e devolve o detalhe atualizado.

`importSoundCaseText` aceita extensões `.txt`/`.md`, MIME `text/plain`/`text/markdown`, máximo de 1 MiB e UTF-8 válido via `TextDecoder("utf-8", { fatal: true })`. Normalizar CRLF para LF sem colapsar parágrafos.

- [ ] **Step 4: Ignorar runtime privado**

Adicionar exatamente `/data/soundcase/` ao bloco de dados privados de `.gitignore`, preservando linhas existentes.

- [ ] **Step 5: Rodar testes e commit**

Run: `npm test -- lib/server/soundcase/store.test.ts && npx tsc --noEmit && git diff --check`

Expected: PASS.

```bash
git add .gitignore lib/server/soundcase/store.ts lib/server/soundcase/store.test.ts
git commit -m "feat(soundcase): persist projects and drafts"
```

### Task 4: Versões, idempotência e fila com lease

**Files:**
- Create: `lib/server/soundcase/jobs.ts`
- Test: `lib/server/soundcase/jobs.test.ts`
- Modify: `lib/server/soundcase/store.ts`
- Modify: `lib/soundcase/types.ts`

**Interfaces:**
- Consumes: store de projetos, `segmentSoundCaseText`, escrita durável.
- Produces: `createSoundCaseVersion`, `claimNextSoundCaseJob`, `renewSoundCaseLease`, `updateSoundCaseChunk`, `finishSoundCaseJob`, `cancelSoundCaseVersion`, `resumeSoundCaseVersion`.

- [ ] **Step 1: Escrever testes de idempotência e lease expirado**

```ts
it("reutiliza versão ativa com o mesmo snapshot", async () => {
  const first = await createSoundCaseVersion(projectId, settings);
  const second = await createSoundCaseVersion(projectId, settings);
  expect(second.version.id).toBe(first.version.id);
  expect(second.created).toBe(false);
});

it("reivindica job após lease expirado e preserva chunks completos", async () => {
  const claimed = await claimNextSoundCaseJob({ workerId: "worker-b", now: expiredAt });
  expect(claimed?.leaseOwner).toBe("worker-b");
  expect(claimed?.manifest.chunks.filter((chunk) => chunk.status === "completed")).toHaveLength(2);
});

it("simula noventa minutos sem executar provider", async () => {
  const source = buildTextForEstimatedMinutes(90);
  const created = await createSoundCaseVersion(projectId, settings, { source });
  expect(created.version.estimatedDurationSeconds).toBeLessThanOrEqual(5_400);
  expect(created.version.manifest.totalChunks).toBeGreaterThan(1);
  expect(openaiMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- lib/server/soundcase/jobs.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar criação transacional da versão**

Calcular `sourceHash`, `settingsHash` e `idempotencyKey = sha256(sourceHash + settingsHash)`. Sob lock global da fila: verificar job ativo equivalente; gravar `source.txt`, `manifest.json`, metadado da versão e só então publicar o job em `jobs.json`.

O lease inicial dura 90 segundos. `claimNextSoundCaseJob` considera `queued`, `interrupted` retomável e `running` com lease expirado. CAS compara `revision` do job antes de cada mutação.

- [ ] **Step 4: Implementar cancelamento e retomada**

`cancelSoundCaseVersion` marca versão e job como `canceled`; o worker consulta o status antes de cada chamada externa. `resumeSoundCaseVersion` valida que o status é `interrupted` ou `failed`, invalida somente chunks ausentes/corrompidos e volta o job para `queued`.

- [ ] **Step 5: Rodar testes e commit**

Run: `npm test -- lib/server/soundcase/jobs.test.ts lib/server/soundcase/store.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add lib/soundcase/types.ts lib/server/soundcase/store.ts lib/server/soundcase/jobs.ts lib/server/soundcase/jobs.test.ts
git commit -m "feat(soundcase): add resumable version queue"
```

### Task 5: Direção estruturada pelo Luna e fallback

**Files:**
- Create: `lib/server/soundcase/direction.ts`
- Test: `lib/server/soundcase/direction.test.ts`

**Interfaces:**
- Consumes: `SoundCaseSegment[]`, vozes permitidas, `createOpenAIClient`.
- Produces: `SOUNDCASE_DIRECTION_PROMPT_VERSION`, `soundCaseDirectionSchema`, `directSoundCase`, `buildFallbackSoundCaseDirection`.

- [ ] **Step 1: Escrever testes de fidelidade e normalização**

```ts
it("aceita somente ids de segmentos fornecidos e vozes permitidas", async () => {
  openai.responses.create.mockResolvedValue(responseWith({
    title: "O cérebro que aprende",
    voice: "marin",
    segmentDirections: [{ segmentId: segments[0].id, instructions: "Tom contemplativo." }]
  }));
  const direction = await directSoundCase({ sourceText, segments }, openai);
  expect(direction.voice).toBe("marin");
  expect(direction.segmentDirections[0].segmentId).toBe(segments[0].id);
  expect(JSON.stringify(direction)).not.toContain(sourceText);
});

it("cai para direção padrão quando o provider falha", async () => {
  openai.responses.create.mockRejectedValue(new Error("provider down"));
  await expect(directSoundCase({ sourceText, segments }, openai)).resolves.toMatchObject({ source: "fallback" });
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- lib/server/soundcase/direction.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar schema strict e prompt-base**

Usar `text: { format: soundCaseDirectionSchema }`, `model: "gpt-5.6-luna"`, `reasoning: { effort: "low" }` e saída curta. O prompt deve declarar: não devolver texto narrado; referenciar somente IDs fornecidos; escolher voz da enum; produzir instruções de interpretação, pronúncias e capa sem texto legível.

Normalizar título para 120 caracteres, resumo para 600, instruções globais para 1200, cada instrução de segmento para 500 e glossário para 80 entradas. Rejeitar IDs desconhecidos e preencher segmentos ausentes com a direção global.

No teste, definir `responseWith(value)` localmente como o envelope mínimo `{ output_text: JSON.stringify(value) }`; o mock nunca chama rede.

- [ ] **Step 4: Implementar fallback determinístico**

O fallback usa `DEFAULT_TTS_INSTRUCTIONS`, voz `marin`, velocidade `1`, título derivado da primeira linha não vazia, resumo local de até 240 caracteres e prompt de capa abstrato sem incluir o texto completo.

- [ ] **Step 5: Rodar testes e commit**

Run: `npm test -- lib/server/soundcase/direction.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add lib/server/soundcase/direction.ts lib/server/soundcase/direction.test.ts
git commit -m "feat(soundcase): add Luna narration direction"
```

### Task 6: Pipeline de áudio, montagem e capa degradável

**Files:**
- Create: `lib/server/soundcase/audio.ts`
- Create: `lib/server/soundcase/cover.ts`
- Create: `lib/server/soundcase/worker.ts`
- Test: `lib/server/soundcase/audio.test.ts`
- Test: `lib/server/soundcase/worker.test.ts`

**Interfaces:**
- Consumes: claim/lease/jobs, direção, manifesto e OpenAI.
- Produces: `synthesizeSoundCaseChunk`, `assembleSoundCaseAudio`, `probeSoundCaseAudio`, `generateSoundCaseCover`, `runNextSoundCaseJob`.

- [ ] **Step 1: Testar retomada e ordem de montagem**

```ts
it("não sintetiza chunk completo novamente", async () => {
  await runNextSoundCaseJob({ workerId: "test", openai, execFile });
  expect(openai.audio.speech.create).toHaveBeenCalledTimes(2);
  expect(openai.audio.speech.create).not.toHaveBeenCalledWith(
    expect.objectContaining({ input: completedChunk.text }),
    expect.anything()
  );
});

it("entrega ao ffmpeg a ordem do manifesto", async () => {
  await assembleSoundCaseAudio(manifest, "mp3", execFile);
  expect(await fs.readFile(concatList, "utf-8")).toBe(
    "file '0000.flac'\nfile '0001.flac'\nfile '0002.flac'\n"
  );
});
```

No mesmo teste do worker, cobrir retry exponencial com relógio/sleep injetável, cancelamento entre chamadas, reentrada após processo novo e falha de capa depois de `audio_ready`. A asserção de enriquecimento parcial deve provar `audio.status = "ready"`, `cover.status = "fallback"` e job terminal `ready`.

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- lib/server/soundcase/audio.test.ts lib/server/soundcase/worker.test.ts`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar síntese FLAC com concorrência 2**

Para cada chunk pendente, chamar `openai.audio.speech.create` com `gpt-4o-mini-tts`, `response_format: "flac"`, voz efetiva, texto exato, velocidade, instrução global e direção do segmento. Gravar resposta em `.part`, validar arquivo não vazio e promover para `${index}.flac`. Persistir manifesto antes de liberar o slot seguinte.

Retry: máximo 4 tentativas por chunk, atrasos de 1 s, 2 s, 4 s e 8 s com jitter injetável nos testes. Renovar lease antes e depois de cada chamada.

- [ ] **Step 4: Implementar FFmpeg/FFprobe sem shell interpolation**

Usar `execFile("/usr/bin/ffmpeg", args)` e `execFile("/usr/bin/ffprobe", args)`. MP3 final usa `libmp3lame`, 192 kbps e metadata UTF-8; FLAC usa `flac`; WAV usa `pcm_s16le`. Só promover `final.*.part` depois de FFprobe devolver duração positiva e o codec esperado.

- [ ] **Step 5: Implementar capa e fallback**

`generateSoundCaseCover` reutiliza o padrão Responses + `image_generation` do Pulse, com `gpt-image-2`, qualidade alta, sem texto legível. Salvar binário PNG fora do JSON. Em falha, gerar uma capa tipográfica SVG sanitizada no servidor, salvar como `cover.svg` e marcar `cover.status = "fallback"`.

- [ ] **Step 6: Implementar máquina do worker**

```ts
export async function runNextSoundCaseJob(deps: SoundCaseWorkerDeps): Promise<SoundCaseWorkerResult> {
  const claimed = await claimNextSoundCaseJob({ workerId: deps.workerId, now: deps.now() });
  if (!claimed) return { status: "empty" };
  try {
    const direction = await ensureDirection(claimed, deps);
    await ensureChunks(claimed, direction, deps);
    const audio = await ensureFinalAudio(claimed, deps);
    await markSoundCaseAudioReady(claimed.versionId, audio);
    await ensureCover(claimed, direction, deps);
    await finishSoundCaseJob(claimed.id, "ready");
    return { status: "completed", versionId: claimed.versionId };
  } catch (error) {
    return interruptSoundCaseJob(claimed, toSafeSoundCaseError(error));
  }
}
```

Definir `SoundCaseWorkerDeps` e `SoundCaseWorkerResult` em `worker.ts`. Manter `ensureDirection`, `ensureChunks`, `ensureFinalAudio`, `markSoundCaseAudioReady`, `ensureCover`, `interruptSoundCaseJob` e `toSafeSoundCaseError` como helpers privados do mesmo módulo, com dependências de relógio, OpenAI, sleep e `execFile` injetáveis para o teste não tocar rede nem binários reais.

- [ ] **Step 7: Rodar testes e commit**

Run: `npm test -- lib/server/soundcase/audio.test.ts lib/server/soundcase/worker.test.ts && npx tsc --noEmit`

Expected: PASS sem rede e sem tocar dados reais.

```bash
git add lib/server/soundcase/audio.ts lib/server/soundcase/audio.test.ts lib/server/soundcase/cover.ts lib/server/soundcase/worker.ts lib/server/soundcase/worker.test.ts
git commit -m "feat(soundcase): build resumable audio worker"
```

### Task 7: APIs de projetos, importação e versões

**Files:**
- Create: `app/api/soundcase/projects/route.ts`
- Create: `app/api/soundcase/projects/route.test.ts`
- Create: `app/api/soundcase/projects/[projectId]/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/import/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/versions/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/versions/[versionId]/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/versions/[versionId]/cancel/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/versions/[versionId]/resume/route.ts`
- Test: `app/api/soundcase/projects/routes.test.ts`

**Interfaces:**
- Consumes: store/jobs e `requireAppAuth`.
- Produces: JSON público definido em `lib/soundcase/types.ts`.

- [ ] **Step 1: Testar auth, CAS, import, idempotência e ações**

```ts
it("autentica antes de ler o body", async () => {
  requireAppAuthMock.mockResolvedValue(new Response(null, { status: 401 }));
  const request = requestWithThrowingJson();
  expect((await POST(request)).status).toBe(401);
  expect(request.json).not.toHaveBeenCalled();
});

it("devolve versão existente para clique idempotente", async () => {
  createSoundCaseVersionMock.mockResolvedValue({ version, created: false });
  const response = await POST_VERSION(validRequest, { params: Promise.resolve({ projectId }) });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ created: false, version: { id: version.id } });
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- app/api/soundcase/projects/route.test.ts app/api/soundcase/projects/routes.test.ts`

Expected: FAIL por rotas ausentes.

- [ ] **Step 3: Implementar handlers finos**

Cada handler chama `requireAppAuth(request)` antes de body/formData. Validar params por regex UUID/opaco. Mapear `SoundCaseError.status` e `code` por `jsonError`; respostas desconhecidas usam mensagem segura e diagnosticId.

Nos testes, definir helpers locais concretos: `requestWithThrowingJson()` devolve um `Request` cujo método `json` é um spy que lança; `validRequest` contém JSON válido; `POST_VERSION` é o alias explícito do handler de versões; `projectId` e `version` vêm das fixtures do próprio arquivo.

`PATCH project` recebe `{ text, revision, title? }`. Import usa `request.formData()`, exige um `File`, verifica `size` antes de `arrayBuffer()` e chama `importSoundCaseText`. `POST versions` aceita settings, chama o limite de duração antes de enfileirar e retorna 201 para nova versão ou 200 para idempotente. Os handlers `DELETE` de projeto e versão exigem confirmação já resolvida na UI, validam IDs conhecidos e removem somente a árvore privada correspondente sob lock.

- [ ] **Step 4: Rodar testes e commit**

Run: `npm test -- app/api/soundcase/projects/route.test.ts app/api/soundcase/projects/routes.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add app/api/soundcase/projects/route.ts app/api/soundcase/projects/route.test.ts app/api/soundcase/projects/'[projectId]'/route.ts app/api/soundcase/projects/'[projectId]'/import/route.ts app/api/soundcase/projects/'[projectId]'/versions/route.ts app/api/soundcase/projects/'[projectId]'/versions/'[versionId]'/route.ts app/api/soundcase/projects/'[projectId]'/versions/'[versionId]'/cancel/route.ts app/api/soundcase/projects/'[projectId]'/versions/'[versionId]'/resume/route.ts app/api/soundcase/projects/routes.test.ts lib/soundcase/types.ts
git commit -m "feat(soundcase): expose project and version APIs"
```

### Task 8: Assets privados, Range e ativação systemd

**Files:**
- Create: `app/api/soundcase/projects/[projectId]/versions/[versionId]/audio/route.ts`
- Create: `app/api/soundcase/projects/[projectId]/versions/[versionId]/cover/route.ts`
- Test: `app/api/soundcase/projects/assets.test.ts`
- Create: `app/api/soundcase/worker/run-next/route.ts`
- Test: `app/api/soundcase/worker/run-next/route.test.ts`
- Create: `scripts/run-soundcase-worker.sh`
- Create: `systemd/chatgpt-soundcase.service`
- Create: `systemd/chatgpt-soundcase.path`
- Create: `systemd/chatgpt-soundcase.timer`

**Interfaces:**
- Consumes: assets validados, `runNextSoundCaseJob`, `SOUNDCASE_WORKER_TOKEN`.
- Produces: HTTP Range correto e runner recuperável.

- [ ] **Step 1: Escrever testes de Range e token obrigatório**

```ts
it("responde byte range inclusivo", async () => {
  const response = await GET_AUDIO(requestWithRange("bytes=10-19"), routeContext);
  expect(response.status).toBe(206);
  expect(response.headers.get("Content-Range")).toBe("bytes 10-19/100");
  expect(response.headers.get("Content-Length")).toBe("10");
});

it("recusa worker sem token mesmo em localhost", async () => {
  process.env.SOUNDCASE_WORKER_TOKEN = "secret";
  expect((await POST_WORKER(localRequestWithoutToken)).status).toBe(401);
  expect(runNextSoundCaseJobMock).not.toHaveBeenCalled();
});
```

Nos testes de assets, `requestWithRange` cria um `Request` autenticado com o header fornecido e `routeContext` usa IDs de uma fixture temporária de 100 bytes. No teste do worker, `localRequestWithoutToken` é um `Request` POST sem bearer e `runNextSoundCaseJobMock` é o mock do módulo do worker.

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- app/api/soundcase/projects/assets.test.ts app/api/soundcase/worker/run-next/route.test.ts`

Expected: FAIL por rotas ausentes.

- [ ] **Step 3: Implementar assets e Range**

Resolver projeto/versão pelo store antes do path. Aceitar somente `bytes=start-end` simples; devolver 416 com `Content-Range: bytes */size` para range inválido. Usar `createReadStream(file, { start, end })` convertido por `Readable.toWeb`. `Content-Disposition` é `inline` sem `?download=1` e `attachment` quando solicitado.

- [ ] **Step 4: Implementar autenticação constante do worker**

Comparar bearer e token configurado com `crypto.timingSafeEqual` somente depois de igualar comprimentos. Token ausente no ambiente é erro 503, nunca autorização por hostname. A rota processa um job e retorna 204 para fila vazia, 200 para conclusão/interrupção.

- [ ] **Step 5: Criar runner e units**

```bash
#!/usr/bin/env bash
set -euo pipefail
url="${SOUNDCASE_WORKER_URL:-http://127.0.0.1:3040/chat/api/soundcase/worker/run-next}"
: "${SOUNDCASE_WORKER_TOKEN:?SOUNDCASE_WORKER_TOKEN ausente}"
while true; do
  soundcase_http_status="$(curl -sS -w '%{http_code}' -o /dev/null -X POST -H "Authorization: Bearer ${SOUNDCASE_WORKER_TOKEN}" "${url}")" || exit 1
  [[ "${soundcase_http_status}" == "204" ]] && exit 0
  [[ "${soundcase_http_status}" == "200" ]] || exit 1
done
```

O service usa `EnvironmentFile=/root/CHATGPT/.env.production`, `After=chatgpt.service`, timeout de 3 horas e logs próprios. O path observa `/root/CHATGPT/data/soundcase/jobs.json`. O timer usa `OnBootSec=2min`, `OnUnitActiveSec=1min` e `Persistent=true`.

- [ ] **Step 6: Rodar testes, validar units e commit**

Run: `npm test -- app/api/soundcase/projects/assets.test.ts app/api/soundcase/worker/run-next/route.test.ts && systemd-analyze verify systemd/chatgpt-soundcase.service systemd/chatgpt-soundcase.path systemd/chatgpt-soundcase.timer && bash -n scripts/run-soundcase-worker.sh && npx tsc --noEmit`

Expected: PASS.

```bash
git add app/api/soundcase/projects/'[projectId]'/versions/'[versionId]'/audio/route.ts app/api/soundcase/projects/'[projectId]'/versions/'[versionId]'/cover/route.ts app/api/soundcase/projects/assets.test.ts app/api/soundcase/worker/run-next/route.ts app/api/soundcase/worker/run-next/route.test.ts scripts/run-soundcase-worker.sh systemd/chatgpt-soundcase.service systemd/chatgpt-soundcase.path systemd/chatgpt-soundcase.timer
git commit -m "feat(soundcase): serve assets and activate durable worker"
```

### Task 9: Realtime compartilhado e fila segmentada

**Files:**
- Create: `lib/server/realtimeCall.ts`
- Test: `lib/server/realtimeCall.test.ts`
- Modify: `app/api/realtime/tts-call/route.ts`
- Modify: `app/api/realtime/tts-call/route.test.ts`
- Create: `app/api/soundcase/realtime-call/route.ts`
- Create: `app/api/soundcase/realtime-call/route.test.ts`
- Create: `hooks/useSoundCaseRealtime.ts`
- Test: `hooks/useSoundCaseRealtime.test.ts`

**Interfaces:**
- Consumes: `SoundCaseSegment[]`, direção e voz efetiva.
- Produces: `createRealtimeCallResponse`, `useSoundCaseRealtime` com `start`, `stop`, `skipToSegment`, status e progresso.

- [ ] **Step 1: Fixar compatibilidade do Chat e configuração do SoundCase**

```ts
it("mantém o payload atual do Chat e aceita instrução SoundCase isolada", () => {
  expect(buildRealtimeSession({ product: "chat", voice: "cedar" })).not.toHaveProperty("max_output_tokens");
  expect(buildRealtimeSession({ product: "soundcase", voice: "marin", instructions: "Leia exatamente." })).toMatchObject({
    type: "realtime",
    model: "gpt-realtime-2.1-mini",
    output_modalities: ["audio"],
    audio: { output: { voice: "marin" } },
    instructions: expect.stringContaining("Leia exatamente.")
  });
});
```

- [ ] **Step 2: Extrair servidor compartilhado sem mudar o Chat**

Mover construção multipart, upstream fetch e erro seguro para `lib/server/realtimeCall.ts`. A rota existente continua produzindo o payload coberto pelos testes atuais. A rota SoundCase recebe SDP como texto e `projectId`/`versionId` na query; após autenticar, resolve voz e direção global no store, sem transportar instruções livres em headers. O texto narrado continua sendo enviado no data channel, não no handshake ou logs.

- [ ] **Step 3: Implementar fila cliente por segmento**

```ts
export interface SoundCaseRealtimeController {
  status: "idle" | "connecting" | "ready" | "speaking" | "paused" | "error";
  activeSegmentIndex: number;
  firstAudioMs: number | null;
  start(input: SoundCaseRealtimeInput): Promise<void>;
  stop(): void;
  skipToSegment(index: number): Promise<void>;
}
```

Ao receber `response.done`, enviar `response.create` para o próximo segmento com instrução de ler somente aquele texto. Encerrar ao último segmento. Abort/cleanup deve fechar data channel, peer, áudio e listeners. Não modificar `hooks/useRealtimeTtsLab.ts`.

- [ ] **Step 4: Rodar testes e commit**

Run: `npm test -- lib/server/realtimeCall.test.ts app/api/realtime/tts-call/route.test.ts app/api/soundcase/realtime-call/route.test.ts hooks/useSoundCaseRealtime.test.ts && npx tsc --noEmit`

Expected: PASS e testes antigos do Chat intactos.

```bash
git add lib/server/realtimeCall.ts lib/server/realtimeCall.test.ts app/api/realtime/tts-call/route.ts app/api/realtime/tts-call/route.test.ts app/api/soundcase/realtime-call/route.ts app/api/soundcase/realtime-call/route.test.ts hooks/useSoundCaseRealtime.ts hooks/useSoundCaseRealtime.test.ts
git commit -m "feat(soundcase): add segmented realtime narration"
```

### Task 10: Cliente HTTP, hook de projeto e progresso real

**Files:**
- Create: `lib/soundcase/api.ts`
- Create: `lib/soundcase/progress.ts`
- Test: `lib/soundcase/api.test.ts`
- Test: `lib/soundcase/progress.test.ts`
- Create: `hooks/useSoundCase.ts`
- Test: `hooks/useSoundCase.test.ts`

**Interfaces:**
- Consumes: rotas das Tasks 7 e 8.
- Produces: `soundCaseApi`, `getSoundCaseProgress`, `useSoundCase`.

- [ ] **Step 1: Testar URL com base path, polling terminal e autosave CAS**

```ts
it("usa base path para listar projetos", async () => {
  await soundCaseApi.listProjects();
  expect(fetch).toHaveBeenCalledWith("/chat/api/soundcase/projects", { cache: "no-store" });
});

it("para polling em estado terminal", () => {
  expect(getSoundCasePollInterval(versionWith("ready"))).toBe(false);
  expect(getSoundCasePollInterval(versionWith("synthesizing"))).toBe(1500);
});
```

Definir `versionWith(status)` como fixture local tipada que preenche manifesto e progresso mínimos; não usar cast parcial nem `any`.

- [ ] **Step 2: Implementar cliente tipado**

Seguir `lib/pulse/pulseApi.ts`: `safeJson`, `parseApiErrorResponse`, `apiUrl`, `encodeURIComponent` em IDs e métodos separados para CRUD, import, generate, cancel, resume e asset URLs.

- [ ] **Step 3: Implementar progresso confirmado**

```ts
export function getSoundCaseProgress(version: SoundCaseVersion): SoundCaseProgressView {
  const completed = version.manifest.completedChunks;
  const total = Math.max(1, version.manifest.totalChunks);
  const synthesis = completed / total;
  const ratio = version.status === "directing" ? 0.08
    : version.status === "synthesizing" ? 0.12 + synthesis * 0.70
    : version.status === "assembling" ? 0.88
    : version.status === "audio_ready" || version.status === "ready" ? 1
    : version.progress.ratio;
  return { ratio, label: progressLabel(version), animated: isActiveStatus(version.status) };
}
```

- [ ] **Step 4: Implementar hook com estado reduzido**

`useSoundCase` lista projetos, carrega o ativo, salva draft com debounce de 700 ms e revision atual, reconcilia em `visibilitychange`/`online`, e faz polling de 1,5 s somente quando há versão ativa não terminal. Conflito 409 recarrega o projeto e preserva texto local como `unsavedText` para decisão explícita; nunca sobrescreve silenciosamente.

- [ ] **Step 5: Rodar testes e commit**

Run: `npm test -- lib/soundcase/api.test.ts lib/soundcase/progress.test.ts hooks/useSoundCase.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add lib/soundcase/api.ts lib/soundcase/api.test.ts lib/soundcase/progress.ts lib/soundcase/progress.test.ts hooks/useSoundCase.ts hooks/useSoundCase.test.ts
git commit -m "feat(soundcase): add project client and reconciliation"
```

### Task 11: Shell desktop, folha, direção e onda

**Files:**
- Create: `app/soundcase/page.tsx`
- Test: `app/soundcase/page.test.ts`
- Create: `components/soundcase/SoundCaseShell.tsx`
- Create: `components/soundcase/SoundCaseEditor.tsx`
- Create: `components/soundcase/DirectionSidebar.tsx`
- Create: `components/soundcase/GenerationWave.tsx`
- Create: `components/soundcase/SoundCase.module.css`
- Test: `components/soundcase/SoundCaseEditor.test.tsx`
- Test: `components/soundcase/DirectionSidebar.test.tsx`

**Interfaces:**
- Consumes: `useSoundCase`, progresso e componentes UI existentes.
- Produces: primeira superfície funcional desktop com criação, edição, import e geração.

- [ ] **Step 1: Testar gate autenticado e ações visíveis**

```ts
it("mantém a página dinâmica e autenticada", () => {
  expect(source).toContain('export const dynamic = "force-dynamic"');
  expect(source).toContain("verifyAuthToken");
  expect(source).toContain("SoundCaseShell");
});

it("expõe automático e os dois modos de geração", () => {
  const markup = renderToStaticMarkup(
    <DirectionSidebar state={readyState} actions={actions} />
  );
  expect(markup).toContain("Automático · Luna");
  expect(markup).toContain("Gerar e ouvir agora");
  expect(markup).toContain("Gerar silenciosamente");
});
```

Usar `renderToStaticMarkup` de `react-dom/server`, padrão vigente dos testes de componentes do projeto; não adicionar Testing Library.

- [ ] **Step 2: Criar página com o mesmo gate do Studio**

Copiar a política dinâmica/uncached de `app/studio/page.tsx`, trocando apenas o shell. Não extrair auth nesta tarefa.

- [ ] **Step 3: Implementar editor e sidebar**

Folha usa `<textarea>` controlado com fonte mínima 16 px no mobile, título visual separado, contagem de palavras, estimativa e input oculto `accept=".txt,.md,text/plain,text/markdown"`. Importação exige ação do usuário e mostra erro local seguro.

Sidebar usa `Switch`, `Slider` e selects nativos estilizados para voz, velocidade e formato. Automático é padrão; qualquer edição marca o campo como override. Botões ficam desabilitados sem texto, em conflito de autosave ou acima do limite.

- [ ] **Step 4: Implementar onda sem custo de layout alto**

`GenerationWave` recebe apenas `{ ratio, status, label }`, anima um wrapper com `transform: translateY()` e `opacity`, respeita `prefers-reduced-motion` e define `aria-live="polite"` somente na legenda. Não animar SVG complexo nem altura do editor.

- [ ] **Step 5: Comparar primeira dobra com referência desktop**

Subir app descartável em porta livre com dados mockados e capturar 1440×900. Comparar via `view_image` com `docs/superpowers-on-demand/specs/assets/soundcase-desktop-blue.webp`; corrigir proporções antes de seguir.

- [ ] **Step 6: Rodar testes e commit**

Run: `npm test -- app/soundcase/page.test.ts components/soundcase/SoundCaseEditor.test.tsx components/soundcase/DirectionSidebar.test.tsx && npx tsc --noEmit`

Expected: PASS.

```bash
git add app/soundcase/page.tsx app/soundcase/page.test.ts components/soundcase/SoundCaseShell.tsx components/soundcase/SoundCaseEditor.tsx components/soundcase/SoundCaseEditor.test.tsx components/soundcase/DirectionSidebar.tsx components/soundcase/DirectionSidebar.test.tsx components/soundcase/GenerationWave.tsx components/soundcase/SoundCase.module.css
git commit -m "feat(soundcase): build editorial generation workspace"
```

### Task 12: Biblioteca, resultado, players e mobile

**Files:**
- Create: `components/soundcase/SoundCaseLibrary.tsx`
- Create: `components/soundcase/SoundCaseResult.tsx`
- Create: `components/soundcase/SoundCasePlayer.tsx`
- Create: `components/soundcase/SoundCaseMobileDock.tsx`
- Test: `components/soundcase/SoundCaseLibrary.test.tsx`
- Test: `components/soundcase/SoundCasePlayer.test.tsx`
- Modify: `components/soundcase/SoundCaseShell.tsx`
- Modify: `components/soundcase/SoundCase.module.css`

**Interfaces:**
- Consumes: `useSoundCase`, `useSoundCaseRealtime`, asset URLs e `ConfirmDialog`.
- Produces: projeto completo desktop/mobile e transição explícita de player.

- [ ] **Step 1: Testar versão, degradação e troca voluntária**

```ts
it("não corta Realtime quando o arquivo final fica pronto", () => {
  const markup = renderToStaticMarkup(
    <SoundCasePlayer realtime={speakingRealtime} version={audioReadyVersion} />
  );
  expect(markup).toContain("Arquivo final pronto");
  expect(speakingRealtime.stop).not.toHaveBeenCalled();
});

it("para Realtime antes de iniciar o arquivo final", async () => {
  await switchToFinalAudio({ stopRealtime, playFinal });
  expect(stopRealtime).toHaveBeenCalledTimes(1);
  expect(playFinal).toHaveBeenCalledTimes(1);
  expect(stopRealtime.mock.invocationCallOrder[0]).toBeLessThan(
    playFinal.mock.invocationCallOrder[0]
  );
});
```

Testar a retomada da biblioteca por `renderToStaticMarkup` e presença do texto `Retomar geração`. Exportar `switchToFinalAudio` como helper puro do player para fixar a ordem sem adicionar Testing Library.

Adicionar casos SSR para todos os estados visíveis da especificação e asserts de nomes acessíveis, `aria-current`, `aria-live`, controles desabilitados e classes de touch target. O smoke em Chrome cobre foco restaurado, navegação por teclado e sheets, pois esses comportamentos não são demonstráveis por markup estático.

- [ ] **Step 2: Implementar biblioteca e resultado**

Biblioteca lista projetos por `updatedAt`, expande versões dentro do projeto selecionado e mostra status real. Exclusão usa `ConfirmDialog`. Resultado selecionado mostra capa privada/fallback, resumo, duração, formato, voz, direção efetiva, data, play e download.

- [ ] **Step 3: Implementar coordenação dos players**

Ao gerar com audição, iniciar `useSoundCaseRealtime` somente depois de a direção aparecer no polling. Se áudio final chegar enquanto Realtime fala, mostrar CTA sem trocar fonte. Ao escolher o final, parar peer antes de iniciar `<audio>`. Reutilizar `primeBrowserAudio` e `describeAudioPlayError`; não modificar o player global do Chat.

- [ ] **Step 4: Implementar breakpoints e sheets**

Desktop ≥1280 px mostra três colunas. De 768 a 1279 px, biblioteca usa `Sheet`. Abaixo de 768 px, sidebar e biblioteca usam sheets full-screen e `SoundCaseMobileDock` fica acima da safe area. Garantir 44 px, foco restaurado e teclado funcional.

- [ ] **Step 5: QA visual mobile**

Capturar viewport 390×844 com estado Realtime + TTS ativo. Comparar via `view_image` com `docs/superpowers-on-demand/specs/assets/soundcase-mobile-blue.webp`; corrigir geometria, contraste, safe area e scroll antes de seguir.

- [ ] **Step 6: Rodar testes e commit**

Run: `npm test -- components/soundcase/SoundCaseLibrary.test.tsx components/soundcase/SoundCasePlayer.test.tsx hooks/useSoundCaseRealtime.test.ts && npx tsc --noEmit`

Expected: PASS.

```bash
git add components/soundcase/SoundCaseLibrary.tsx components/soundcase/SoundCaseLibrary.test.tsx components/soundcase/SoundCaseResult.tsx components/soundcase/SoundCasePlayer.tsx components/soundcase/SoundCasePlayer.test.tsx components/soundcase/SoundCaseMobileDock.tsx components/soundcase/SoundCaseShell.tsx components/soundcase/SoundCase.module.css hooks/useSoundCaseRealtime.ts hooks/useSoundCaseRealtime.test.ts
git commit -m "feat(soundcase): add library players and mobile layout"
```

### Task 13: Navegação, operação, documentação e validação integrada

**Files:**
- Create: `components/navigation/ProductNav.tsx`
- Test: `components/navigation/ProductNav.test.tsx`
- Modify: `components/workspace-v2/WorkspaceLayoutV2.tsx`
- Modify: `components/studio/GauchoStudioShell.tsx`
- Modify: `components/studio/GauchoStudioShell.module.css`
- Modify: `components/command/CommandPalette.tsx`
- Modify: `.env.example`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/INFRASTRUCTURE.md`
- Modify: `docs/MODELS.md`
- Modify: `/etc/apache2/APACHE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: rota SoundCase, units e estados já validados.
- Produces: entrada descoberta em Chat/Studio, runtime documentado e entrega pronta para revisão.

- [ ] **Step 1: Testar navegação base-path-safe**

```ts
it("marca SoundCase e mantém rotas internas para o Next aplicar basePath", () => {
  const markup = renderToStaticMarkup(<ProductNav active="soundcase" />);
  expect(markup).toContain('href="/"');
  expect(markup).toContain('href="/studio"');
  expect(markup).toContain('href="/soundcase"');
  expect(markup).toContain('aria-current="page"');
});
```

- [ ] **Step 2: Integrar navegação sem reestruturar shells**

Adicionar `ProductNav` ao header desktop do Chat, topbar do Studio e header do SoundCase. No mobile do Chat/Studio, incluir acesso ao SoundCase sem remover ações específicas. Adicionar comando `Abrir SoundCase` à palette. Não alterar Pulse, composer ou painel contextual.

- [ ] **Step 3: Instalar configuração operacional com backup**

Gerar `SOUNDCASE_WORKER_TOKEN` local sem imprimir valor, acrescentar em `.env.production` com modo preservado e guardar backup datado antes da edição. Instalar cópias das três units em `/etc/systemd/system/`, rodar `systemctl daemon-reload`, habilitar `chatgpt-soundcase.path` e `chatgpt-soundcase.timer`, e confirmar estado com `systemctl is-active/is-enabled`.

Antes de tocar Apache, reler `/etc/apache2/APACHE.md`. Nenhuma nova `ProxyPass` é necessária porque `/chat` já cobre a rota; acrescentar apenas `/chat/soundcase` e `/chat/api/soundcase/*` ao mapa. Não mover `ProxyPassReverseCookiePath`.

- [ ] **Step 4: Atualizar docs preservando WIP**

Documentar variáveis `SOUNDCASE_DATA_DIR`, `SOUNDCASE_WORKER_TOKEN`, `SOUNDCASE_WORKER_URL` e `SOUNDCASE_TTS_CONCURRENCY`; APIs; dados privados; units; modelos; formatos; limite; Realtime vs arquivo final. Reler `git diff` de cada doc imediatamente antes e depois da edição.

- [ ] **Step 5: Rodar validação automatizada completa**

Run: `npm test && npx tsc --noEmit && NEXT_PUBLIC_BASE_PATH=/chat npm run build && git diff --check`

Expected: todos os testes, typecheck, build e diff check verdes. Falhas não relacionadas devem ser provadas como `PRE_EXISTING_FAILURE`; falha de build bloqueia fechamento.

- [ ] **Step 6: Validar runtime sem criar dados pessoais**

Reiniciar `chatgpt.service`, verificar `systemctl is-active chatgpt.service`, `systemctl is-active chatgpt-soundcase.path`, `systemctl is-active chatgpt-soundcase.timer`, `http://127.0.0.1:3040/chat/api/health` e `https://ultrassom.ai/chat/api/health`.

Criar um projeto temporário autenticado, gerar primeiro um texto curto para provar pipeline e cleanup, depois executar o smoke aprovado de aproximadamente 15 minutos. Fechar a aba, interromper controladamente o worker, retomar e confirmar pelo manifesto que nenhum chunk completo foi repetido. Validar MP3 completo e gerações focais FLAC/WAV com FFprobe. Excluir o projeto temporário na mesma rodada.

- [ ] **Step 7: QA visual final**

Capturar desktop e 390×844 no Google Chrome autenticado, sem segredos em tela. Usar `view_image` para comparar cada screenshot com as referências aprovadas. Corrigir diferenças de layout, cor, tipografia, estado, scroll e touch target; repetir build e smoke focal após qualquer correção.

- [ ] **Step 8: Commit de integração**

```bash
git add components/navigation/ProductNav.tsx components/navigation/ProductNav.test.tsx components/workspace-v2/WorkspaceLayoutV2.tsx components/studio/GauchoStudioShell.tsx components/studio/GauchoStudioShell.module.css components/command/CommandPalette.tsx .env.example docs/API.md docs/ARCHITECTURE.md docs/INFRASTRUCTURE.md docs/MODELS.md AGENTS.md
git commit -m "feat(soundcase): integrate navigation and operations"
```

Não adicionar `.env.production`, dados runtime, áudio, capas ou arquivos temporários ao commit. `/etc/apache2/APACHE.md` e units instaladas no host são evidência operacional fora do Git do projeto.
