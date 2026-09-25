import { describe, expect, it } from "vitest";
import {
  appendDeepResearchInstructions,
  buildDeepResearchInstructions,
} from "@/lib/chat/deepResearchPrompt";

describe("buildDeepResearchInstructions", () => {
  it("descreve um único agente que apura e redige, sem subagentes nem scripts", () => {
    const prompt = buildDeepResearchInstructions("deepsearch_high");

    expect(prompt).toContain("## Deep Research — agente único");
    expect(prompt).toMatch(/quem apura não redige/i);
    expect(prompt).toMatch(/sem subagentes/i);
    expect(prompt).toMatch(/nenhum script/i);
    expect(prompt).toContain("web_search");
  });

  it("carrega as rodadas de apuração e as oito regras da prosa encadeada", () => {
    const prompt = buildDeepResearchInstructions("deepsearch_medium");

    for (const round of ["R1", "R2", "R3", "R4"]) {
      expect(prompt).toContain(round);
    }
    expect(prompt).toMatch(/given → new/);
    expect(prompt).toMatch(/Negrito como âncora/);
    expect(prompt).toMatch(/Fechamento que ecoa a abertura/);
    expect(prompt).toMatch(/Nunca invente/i);
    expect(prompt).toContain("## Referências");
    expect(prompt).toContain("## Nota de cobertura");
  });

  it("dimensiona o esforço pelo nível: médio mais brando, alto extenso", () => {
    const medium = buildDeepResearchInstructions("deepsearch_medium");
    const high = buildDeepResearchInstructions("deepsearch_high");

    expect(medium).toContain("Nível: Deepsearch Medium");
    expect(medium).toContain("3.500");
    expect(medium).toMatch(/5–7 seções/);
    expect(high).toContain("Nível: Deepsearch High");
    expect(high).toContain("8.000");
    expect(high).toMatch(/8–12 seções/);
    expect(high).not.toContain("Nível: Deepsearch Medium");
  });
});

describe("appendDeepResearchInstructions", () => {
  it("anexa o prompt de pesquisa ao system prompt sem o bloco do modo Documento", () => {
    const message = appendDeepResearchInstructions("Base do Gaúcho", "deepsearch_high");

    expect(message.startsWith("Base do Gaúcho\n\n---\n\n## Deep Research — agente único")).toBe(true);
    expect(message).toContain("## Âncora de estilo");
    expect(message).not.toContain("## Document Mode");
    expect(message).not.toContain("## Clinical Report Style");
  });
});
