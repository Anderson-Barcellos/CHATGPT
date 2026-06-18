import { describe, expect, it } from "vitest";
import { cleanCitationMarkers, createMessageArtifact } from "@/lib/artifacts/messageArtifacts";

describe("messageArtifacts citation cleanup", () => {
  it("removes empty citation wrappers left behind by stripped markers", () => {
    const content = [
      "Primeiro paragrafo ().",
      "Segundo paragrafo ([]).",
      "Terceiro paragrafo ( [1] ).",
      "Quarto paragrafo (【1†fonte】).",
    ].join("\n");

    expect(cleanCitationMarkers(content)).toBe(
      [
        "Primeiro paragrafo.",
        "Segundo paragrafo.",
        "Terceiro paragrafo [1].",
        "Quarto paragrafo [1].",
      ].join("\n")
    );
  });

  it("replaces redundant inline hostname citations with ordered indices from metadata", () => {
    const content = [
      "Texto base (example.com).",
      "",
      "Outro paragrafo",
      "(Fonte: docs.example.org)",
    ].join("\n");

    expect(
      cleanCitationMarkers(content, [
        { title: "Example", url: "https://example.com/page" },
        { title: "Docs", url: "https://docs.example.org/guide" },
      ])
    ).toBe(["Texto base [1].", "", "Outro paragrafo [2]"].join("\n"));
  });

  it("advances indices across repeated same-host references using citation order", () => {
    const content = [
      "Paragrafo um (poppy-playtime.fandom.com).",
      "",
      "Paragrafo dois (poppy-playtime.fandom.com).",
    ].join("\n");

    expect(
      cleanCitationMarkers(content, [
        { title: "Cap 4", url: "https://poppy-playtime.fandom.com/wiki/Chapter_4" },
        { title: "Cap 5", url: "https://poppy-playtime.fandom.com/wiki/Chapter_5" },
      ])
    ).toBe(["Paragrafo um [1].", "", "Paragrafo dois [2]."].join("\n"));
  });

  it("collapses duplicate numeric markers from inline hostnames plus OpenAI markers", () => {
    const content = [
      "Texto com fonte duplicada (example.com)【1†fonte】.",
      "Outro texto com marcador ja numerado [1] 【1†fonte】.",
    ].join("\n");

    expect(
      cleanCitationMarkers(content, [
        { title: "Example", url: "https://example.com/page" },
      ])
    ).toBe(
      [
        "Texto com fonte duplicada [1].",
        "Outro texto com marcador ja numerado [1].",
      ].join("\n")
    );
  });

  it("cleans redundant inline hostname citations before building document artifacts", () => {
    const artifact = createMessageArtifact(
      [
        "# Titulo",
        "",
        "Primeiro paragrafo bem longo para passar do limite minimo do artefato e manter a validacao ativa. (example.com)",
        "",
        "Segundo paragrafo tambem suficientemente longo para preservar a estrutura do documento sem o dominio redundante no fim. (example.com)",
      ].join("\n"),
      {
        force: true,
        displayMode: "document",
        citations: [{ title: "Example", url: "https://example.com/page" }],
      }
    );

    expect(artifact?.content).not.toContain("(example.com)");
    expect(artifact?.content).toContain("[1]");
    expect(artifact?.summary).not.toContain("example.com");
  });
});
