// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCapturesPanelV2 } from "./WorkspaceCapturesPanelV2";
import { CommandComposerContainerV2 } from "./CommandComposerContainerV2";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { createWorkspaceNote } from "@/lib/storage/workspaceNotesApi";

vi.mock("@/hooks/useSpeechToText", () => ({ useSpeechToText: vi.fn() }));
vi.mock("@/lib/storage/workspaceNotesApi", () => ({
  listWorkspaceNotes: vi.fn().mockResolvedValue([]), createWorkspaceNote: vi.fn(), deleteWorkspaceNote: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
let speech: ReturnType<typeof useSpeechToText>;
let preview: ((text: string) => void) | undefined;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList;
  speech = {
    status: "idle", transcriptPreview: "", audioLevel: 0, recordingDurationMs: 0, error: null, isSupported: true,
    startRecording: vi.fn().mockResolvedValue(true), stopRecording: vi.fn().mockResolvedValue("Texto final da nota."),
    toggleRecording: vi.fn().mockResolvedValue(null),
  };
  vi.mocked(useSpeechToText).mockImplementation((options) => { preview = options?.onTranscriptPreview; return speech; });
  vi.mocked(createWorkspaceNote).mockImplementation(async (input) => ({ ...input, id: "sintetica", title: "Captura", source: "stt", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
const click = async (button: Element) => act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
describe("ditado nas superfícies existentes", () => {
  it("notas mostram deltas sem persistir e salvam exatamente uma captura ao parar", async () => {
    const render = async () => act(async () => root.render(createElement(WorkspaceCapturesPanelV2, { context: "notes" })));
    await render();
    speech = { ...speech, status: "recording", transcriptPreview: "Primeiro trecho" }; await render();
    expect(container.textContent).toContain("Primeiro trecho");
    speech = { ...speech, transcriptPreview: "Primeiro trecho e continuação" }; await render();
    expect(container.textContent).toContain("Primeiro trecho e continuação");
    expect(createWorkspaceNote).not.toHaveBeenCalled();
    const stop = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Parar"))!;
    await act(async () => { stop.click(); stop.click(); });
    expect(speech.stopRecording).toHaveBeenCalledOnce();
    expect(createWorkspaceNote).toHaveBeenCalledOnce();
    expect(createWorkspaceNote).toHaveBeenCalledWith(expect.objectContaining({ body: "Texto final da nota.", source: "stt" }));
  });
  it("erro não salva um parcial como nota completa", async () => {
    speech = { ...speech, status: "error", transcriptPreview: "Só uma parte", error: "Conexão interrompida" };
    await act(async () => root.render(createElement(WorkspaceCapturesPanelV2, { context: "notes" })));
    expect(container.textContent).toContain("captura não salva");
    expect(container.textContent).toContain("Só uma parte");
    expect(createWorkspaceNote).not.toHaveBeenCalled();
  });
  it("falha ao salvar mantém o texto disponível para copiar, sem repetir o POST", async () => {
    speech = { ...speech, status: "recording" };
    vi.mocked(createWorkspaceNote).mockRejectedValue(new Error("Rede indisponível"));
    await act(async () => root.render(createElement(WorkspaceCapturesPanelV2, { context: "notes" })));
    const stop = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Parar"))!;
    await click(stop);
    expect(createWorkspaceNote).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Teu texto está preservado aqui");
    expect(container.textContent).toContain("Texto final da nota.");
    expect(container.textContent).toContain("Copiar texto preservado");
  });
  it("chat preserva o rascunho, substitui deltas, não envia e libera edição ao parar", async () => {
    const sendMessage = vi.fn();
    const render = async () => act(async () => root.render(createElement(CommandComposerContainerV2, {
      sendMessage, stopGeneration: vi.fn(), isLoading: false, error: null,
    })));
    await render();
    const textarea = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Rascunho anterior");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(container.querySelector('[aria-label="Gravar áudio"]')!);
    speech = { ...speech, status: "recording" }; await render();
    await act(async () => preview?.("Começo"));
    expect(textarea.value).toBe("Rascunho anterior\nComeço");
    await act(async () => preview?.("Começo e fim."));
    expect(textarea.value).toBe("Rascunho anterior\nComeço e fim.");
    expect(textarea.readOnly).toBe(true);
    await act(async () => textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(sendMessage).not.toHaveBeenCalled();
    vi.mocked(speech.toggleRecording).mockResolvedValue("Começo e fim.");
    await click(container.querySelector('[aria-label="Encerrar gravação"]')!);
    speech = { ...speech, status: "idle" }; await render();
    expect(textarea.value).toBe("Rascunho anterior\nComeço e fim.");
    expect(textarea.readOnly).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
