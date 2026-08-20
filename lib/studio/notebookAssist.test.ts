import { describe, expect, it } from "vitest";
import { extractPythonCodeBlock } from "@/lib/studio/notebookAssist";

describe("extractPythonCodeBlock", () => {
  it("extrai o primeiro bloco ```python", () => {
    const markdown =
      "Aqui está:\n```python\nprint('oi')\n```\nE mais um:\n```python\nx = 2\n```";
    expect(extractPythonCodeBlock(markdown)).toBe("print('oi')");
  });

  it("aceita fence sem linguagem", () => {
    expect(extractPythonCodeBlock("```\nx = 1\n```")).toBe("x = 1");
  });

  it("sem fence, devolve o texto aparado", () => {
    expect(extractPythonCodeBlock("  x = 3\n")).toBe("x = 3");
  });

  it("bloco vazio cai no texto aparado", () => {
    expect(extractPythonCodeBlock("```python\n```")).toBe("```python\n```");
  });
});
