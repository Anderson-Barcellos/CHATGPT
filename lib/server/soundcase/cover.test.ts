import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeBufferDurable, writeTextDurable } from "./files";
import { generateSoundCaseCover } from "./cover";

vi.mock("./files", () => ({
  resolveSoundCasePath: (...parts: string[]) => parts.join("/"),
  writeBufferDurable: vi.fn().mockResolvedValue(undefined),
  writeTextDurable: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => vi.clearAllMocks());

describe("capa SoundCase com Sunburst", () => {
  it("encaminha a geração e mantém o contrato PNG durável", async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const create = vi.fn().mockResolvedValue({ output: [{
      type: "image_generation_call", status: "completed", result: png.toString("base64"),
    }] });
    const result = await generateSoundCaseCover({
      projectId: "synthetic-project", versionId: "synthetic-version",
      title: "Capa sintética", prompt: "Ilustração de teste", client: { responses: { create } },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      store: false,
      tools: [expect.objectContaining({
        type: "image_generation", model: "gpt-image-2.5-sunburst", quality: "high", output_format: "png",
      })],
    }), expect.any(Object));
    expect(result).toEqual({ status: "ready", contentType: "image/png", fileName: "cover.png" });
    expect(writeBufferDurable).toHaveBeenCalledWith(
      "projects/synthetic-project/versions/synthetic-version/cover.png", png,
    );
    expect(writeTextDurable).not.toHaveBeenCalled();
  });

  it("preserva a capa SVG substituta quando o provedor falha", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Falha sintética"));
    const result = await generateSoundCaseCover({
      projectId: "synthetic-project", versionId: "synthetic-version",
      title: "Capa <sintética>", prompt: "Ilustração de teste", client: { responses: { create } },
    });
    expect(result).toEqual({ status: "fallback", contentType: "image/svg+xml", fileName: "cover.svg" });
    expect(writeTextDurable).toHaveBeenCalledWith(
      "projects/synthetic-project/versions/synthetic-version/cover.svg",
      expect.stringContaining("Capa &lt;sintética&gt;"),
    );
    expect(writeBufferDurable).not.toHaveBeenCalled();
  });
});
