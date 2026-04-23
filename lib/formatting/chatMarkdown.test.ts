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
});
