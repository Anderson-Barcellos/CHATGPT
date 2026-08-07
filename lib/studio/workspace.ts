import { DEFAULT_STUDIO_MODEL_ID, isStudioModelId } from "@/lib/studio/models";
import type {
  StudioAssistantMessage,
  StudioFile,
  StudioFileLanguage,
  StudioWorkspaceSnapshot,
} from "@/lib/studio/types";

export const STUDIO_STORAGE_KEY = "gaucho-studio:workspace:v1";
export const STUDIO_MAX_ASSISTANT_MESSAGES = 50;

interface StudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const CALCULATOR_SOURCE = `export type Operacao = "soma" | "subtracao" | "multiplicacao" | "divisao";

export interface CalcularEntrada {
  a: number;
  b: number;
  operacao: Operacao;
}

export interface CalcularResultado {
  resultado: number;
}

export function calcular({ a, b, operacao }: CalcularEntrada): CalcularResultado {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("Operandos devem ser numeros validos.");
  }

  switch (operacao) {
    case "soma":
      return { resultado: a + b };
    case "subtracao":
      return { resultado: a - b };
    case "multiplicacao":
      return { resultado: a * b };
    case "divisao":
      if (b === 0) {
        throw new Error("Divisao por zero nao e permitida.");
      }
      return { resultado: a / b };
    default: {
      const _exhaustive: never = operacao;
      throw new Error(\`Operacao nao suportada: \${_exhaustive}\`);
    }
  }
}

const demo = calcular({ a: 20, b: 22, operacao: "soma" });
console.log("Resultado:", demo.resultado);`;

const LEGACY_INDEX_SOURCE = `import { calcular } from "./utils/calculadora";\n\nconsole.log(calcular({ a: 20, b: 22, operacao: "soma" }));`;
const STANDALONE_INDEX_SOURCE = `const mensagem: string = "Gaucho Studio pronto";\n\nconsole.log(mensagem);`;

const INITIAL_FILES: StudioFile[] = [
  {
    path: "src/utils/calculadora.ts",
    name: "calculadora.ts",
    language: "typescript",
    content: CALCULATOR_SOURCE,
  },
  {
    path: "src/index.ts",
    name: "index.ts",
    language: "typescript",
    content: STANDALONE_INDEX_SOURCE,
  },
  {
    path: "src/tipos.ts",
    name: "tipos.ts",
    language: "typescript",
    content: `export type Resultado<T> =\n  | { ok: true; value: T }\n  | { ok: false; error: string };`,
  },
  {
    path: "package.json",
    name: "package.json",
    language: "json",
    content: `{
  "name": "calculadora-app",
  "private": true,
  "scripts": {
    "start": "tsx src/index.ts"
  }
}`,
  },
  {
    path: "tsconfig.json",
    name: "tsconfig.json",
    language: "json",
    content: `{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext"
  }
}`,
  },
  {
    path: "README.md",
    name: "README.md",
    language: "markdown",
    content: "# Calculadora app\n\nProjeto local de exemplo do Gaucho Studio.",
  },
];

const INITIAL_ASSISTANT_MESSAGES: StudioAssistantMessage[] = [
  {
    id: "studio-welcome-user",
    role: "user",
    content: "Revise esta função e sugira uma versão mais segura.",
    createdAt: "2026-08-06T17:22:00.000Z",
    status: "completed",
  },
  {
    id: "studio-welcome-assistant",
    role: "assistant",
    content: `Sua função já tem boas validações. Abaixo está uma versão mais segura com verificação de tipo estrita, proteção contra NaN e tratamento mais explícito de erros.

\`\`\`typescript
export function calcularSegura({
  a,
  b,
  operacao,
}: CalcularEntrada): CalcularResultado {
  const isValidNumber = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n);

  if (!isValidNumber(a) || !isValidNumber(b)) {
    throw new Error('Operandos devem ser números finitos.');
  }

  switch (operacao) {
    case 'soma':
      return { resultado: a + b };
    case 'subtracao':
      return { resultado: a - b };
    case 'multiplicacao':
      return { resultado: a * b };
    case 'divisao':
      if (b === 0) {
        throw new Error('Divisão por zero não é permitida.');
      }
      return { resultado: a / b };
    default:
      throw new Error(\`Operação não suportada: \${operacao}\`);
  }
}
\`\`\``,
    createdAt: "2026-08-06T17:23:00.000Z",
    status: "completed",
  },
];

function filesToRecord(files: StudioFile[]): Record<string, StudioFile> {
  return Object.fromEntries(files.map((file) => [file.path, { ...file }]));
}

export function createInitialStudioWorkspace(): StudioWorkspaceSnapshot {
  return {
    version: 1,
    autocompleteEnabled: true,
    files: filesToRecord(INITIAL_FILES),
    openFilePaths: [
      "src/utils/calculadora.ts",
      "src/index.ts",
      "src/tipos.ts",
    ],
    activeFilePath: "src/utils/calculadora.ts",
    assistantMessages: INITIAL_ASSISTANT_MESSAGES.map((message) => ({
      ...message,
    })),
    selectedModelId: DEFAULT_STUDIO_MODEL_ID,
  };
}

function isStudioFileLanguage(value: unknown): value is StudioFileLanguage {
  return [
    "typescript",
    "javascript",
    "python",
    "json",
    "markdown",
    "plaintext",
  ].includes(String(value));
}

function normalizeFiles(value: unknown): Record<string, StudioFile> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized: Record<string, StudioFile> = {};
  for (const [path, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }

    const file = candidate as Partial<StudioFile>;
    if (
      typeof file.path !== "string" ||
      file.path !== path ||
      typeof file.name !== "string" ||
      typeof file.content !== "string" ||
      !isStudioFileLanguage(file.language)
    ) {
      continue;
    }

    normalized[path] = {
      path,
      name: file.name,
      language: file.language,
      content: file.content,
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeMessages(value: unknown): StudioAssistantMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }

    const message = candidate as Partial<StudioAssistantMessage>;
    if (
      typeof message.id !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      typeof message.createdAt !== "string"
    ) {
      return [];
    }

    const wasInterrupted =
      message.role === "assistant" &&
      (message.status === "streaming" || message.status === "interrupted");

    return [
      {
        id: message.id,
        role: message.role,
        content:
          wasInterrupted && !message.content.trim()
            ? "Resposta interrompida."
            : message.content,
        createdAt: message.createdAt,
        status: message.status === "failed"
          ? "failed"
          : wasInterrupted
            ? "interrupted"
            : "completed",
      } satisfies StudioAssistantMessage,
    ];
  }).slice(-STUDIO_MAX_ASSISTANT_MESSAGES);
}

export function limitStudioAssistantMessages(
  messages: StudioAssistantMessage[]
): StudioAssistantMessage[] {
  return messages.slice(-STUDIO_MAX_ASSISTANT_MESSAGES);
}

export function applyStudioWorkspaceMutation(
  current: StudioWorkspaceSnapshot,
  mutator: (
    current: StudioWorkspaceSnapshot
  ) => StudioWorkspaceSnapshot
): { workspace: StudioWorkspaceSnapshot; changed: boolean } {
  const workspace = mutator(current);
  return { workspace, changed: workspace !== current };
}

export function parseStudioWorkspace(
  raw: string | null
): StudioWorkspaceSnapshot {
  const fallback = createInitialStudioWorkspace();
  if (!raw) return fallback;

  try {
    const candidate = JSON.parse(raw) as Partial<StudioWorkspaceSnapshot>;
    if (candidate.version !== 1) return fallback;

    const files = normalizeFiles(candidate.files);
    if (!files) return fallback;

    const legacyIndex = files["src/index.ts"];
    if (legacyIndex?.content === LEGACY_INDEX_SOURCE) {
      files["src/index.ts"] = {
        ...legacyIndex,
        content: STANDALONE_INDEX_SOURCE,
      };
    }

    const validPaths = new Set(Object.keys(files));
    const openFilePaths = Array.isArray(candidate.openFilePaths)
      ? candidate.openFilePaths.filter(
          (path): path is string =>
            typeof path === "string" && validPaths.has(path)
        )
      : [];
    const activeFilePath =
      typeof candidate.activeFilePath === "string" &&
      validPaths.has(candidate.activeFilePath)
        ? candidate.activeFilePath
        : openFilePaths[0] ?? Object.keys(files)[0];

    if (!openFilePaths.includes(activeFilePath)) {
      openFilePaths.unshift(activeFilePath);
    }

    return {
      version: 1,
      autocompleteEnabled:
        typeof candidate.autocompleteEnabled === "boolean"
          ? candidate.autocompleteEnabled
          : true,
      files,
      openFilePaths,
      activeFilePath,
      assistantMessages: normalizeMessages(candidate.assistantMessages),
      selectedModelId: isStudioModelId(candidate.selectedModelId)
        ? candidate.selectedModelId
        : DEFAULT_STUDIO_MODEL_ID,
    };
  } catch {
    return fallback;
  }
}

export function readStudioWorkspaceFromStorage(storage: StudioStorage): {
  workspace: StudioWorkspaceSnapshot;
  ok: boolean;
} {
  try {
    return {
      workspace: parseStudioWorkspace(storage.getItem(STUDIO_STORAGE_KEY)),
      ok: true,
    };
  } catch {
    return { workspace: createInitialStudioWorkspace(), ok: false };
  }
}

export function writeStudioWorkspaceToStorage(
  storage: StudioStorage,
  workspace: StudioWorkspaceSnapshot
): boolean {
  const boundedWorkspace = {
    ...workspace,
    assistantMessages: limitStudioAssistantMessages(
      workspace.assistantMessages
    ),
  };

  try {
    storage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(boundedWorkspace));
    return true;
  } catch {
    try {
      storage.setItem(
        STUDIO_STORAGE_KEY,
        JSON.stringify({ ...boundedWorkspace, assistantMessages: [] })
      );
      return true;
    } catch {
      return false;
    }
  }
}
