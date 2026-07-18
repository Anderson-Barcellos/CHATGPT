import { describe, expect, it } from "vitest";
import { parseTranscriptionStreamLine } from "./stream";

describe("parseTranscriptionStreamLine", () => {
  it("parses delta and done events", () => {
    expect(parseTranscriptionStreamLine('{"type":"delta","delta":"Ola"}')).toEqual({
      type: "delta",
      delta: "Ola",
    });
    expect(parseTranscriptionStreamLine('{"type":"done","text":"Ola mundo"}')).toEqual({
      type: "done",
      text: "Ola mundo",
    });
  });

  it("ignores blank lines and rejects malformed events", () => {
    expect(parseTranscriptionStreamLine("  ")).toBeNull();
    expect(() => parseTranscriptionStreamLine('{"type":"delta"}')).toThrow(
      "Evento de transcricao invalido."
    );
  });
});
