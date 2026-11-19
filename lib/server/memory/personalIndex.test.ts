import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { personalChunks, validatePersonalChunks } from "./personalIndex";
import { collectPersonalSources } from "./personalSources";
import type { Memory } from "@/types";

describe("current personal source retrieval", () => {
  it("preserves long originals in retrievable chunks", () => {
    const sources = [{ id: "memory:1", text: "a".repeat(1200) + "Detalhe no final: protocolo 743." }];
    const chunks = personalChunks(sources);
    expect(chunks.some(c => c.text.includes("protocolo 743"))).toBe(true);
    expect(validatePersonalChunks(chunks, sources)).toHaveLength(chunks.length);
  });
  it("rejects stale, deleted and fabricated chunks", () => {
    const sources = [{ id: "memory:1", text: "Preferia café em 2023." }];
    const chunks = personalChunks(sources);
    expect(validatePersonalChunks(chunks, [])).toEqual([]);
    expect(validatePersonalChunks(chunks, [{ ...sources[0], text: "Prefere chá." }])).toEqual([]);
    expect(validatePersonalChunks([{ ...chunks[0], text: "Outro fato" }], sources)).toEqual([]);
  });
  it("excludes paused memories and behavioral rules from personal synthesis", () => {
    const memories = [{ id: "1", content: "Ativa", isActive: true, priority: 1 }, { id: "2", content: "Pausada", isActive: false, priority: 2 }] as Memory[];
    const sources = collectPersonalSources({ id: "default", contextAboutUser: "Perfil", importedBiography: "Biografia", responsePreferences: "Regra literal", customSystemInstructions: "Outra regra" }, memories);
    expect(sources.map(s => s.text)).toEqual(["Biografia", "Perfil", "Ativa"]);
  });
});
