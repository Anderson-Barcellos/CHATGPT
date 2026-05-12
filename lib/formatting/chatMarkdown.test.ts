import { describe, expect, it } from "vitest";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";

describe("normalizeChatMarkdown", () => {
  it("normalizes escaped newlines, likely /n breaks and removes citations", () => {
    const input =
      "Titulo\\n\\nParagrafo/n- item 1\\n- item 2\n\nFim";

    expect(normalizeChatMarkdown(input)).toBe(
      "Titulo\n\nParagrafo\n- item 1\n- item 2\n\nFim"
    );
  });

  it("preserves fenced code blocks while normalizing surrounding prose", () => {
    const input = [
      "Antes\\n\\n```ts",
      "const raw = \"linha 1\\\\nlinha 2\";",
      "```",
      "Depois/n## Secao",
    ].join("\n");

    expect(normalizeChatMarkdown(input)).toBe(
      ['Antes', "", "```ts", 'const raw = "linha 1\\\\nlinha 2";', "```", "Depois", "", "## Secao"].join(
        "\n"
      )
    );
  });

  it("preserves indentation-sensitive markdown outside code fences", () => {
    const input = [
      "- item 1",
      "  - subitem 1.1",
      "  - subitem 1.2",
      "",
      "1. passo",
      "   1. subpasso",
    ].join("\n");

    expect(normalizeChatMarkdown(input)).toBe(input);
  });

  it("does not collapse intentional blank lines inside fenced code blocks", () => {
    const input = [
      "Texto antes",
      "",
      "```md",
      "linha 1",
      "",
      "",
      "linha 2",
      "```",
      "",
      "Texto depois",
    ].join("\n");

    expect(normalizeChatMarkdown(input)).toBe(input);
  });
});
