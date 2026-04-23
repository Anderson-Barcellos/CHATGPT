import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import {
  STREAMING_CURSOR_TAG,
  rehypeStreamingCursor,
} from "@/lib/chat/rehypeStreamingCursor";

function paragraph(text: string): Element {
  return {
    type: "element",
    tagName: "p",
    properties: {},
    children: [{ type: "text", value: text }],
  };
}

function list(items: string[]): Element {
  return {
    type: "element",
    tagName: "ul",
    properties: {},
    children: items.map<Element>((value) => ({
      type: "element",
      tagName: "li",
      properties: {},
      children: [{ type: "text", value }],
    })),
  };
}

function heading(level: number, text: string): Element {
  return {
    type: "element",
    tagName: `h${level}`,
    properties: {},
    children: [{ type: "text", value: text }],
  };
}

function runPlugin(tree: Root): Root {
  rehypeStreamingCursor()(tree);
  return tree;
}

describe("rehypeStreamingCursor", () => {
  it("appends the cursor as the last child of the final paragraph", () => {
    const tree: Root = {
      type: "root",
      children: [paragraph("Olá mundo"), paragraph("Segundo em stream")],
    };
    runPlugin(tree);

    const lastParagraph = tree.children[1] as Element;
    const lastChild = lastParagraph.children.at(-1) as Element;

    expect(lastChild.type).toBe("element");
    expect(lastChild.tagName).toBe(STREAMING_CURSOR_TAG);
  });

  it("descends into containers and anchors at the last list item", () => {
    const tree: Root = {
      type: "root",
      children: [paragraph("intro"), list(["um", "dois"])],
    };
    runPlugin(tree);

    const ul = tree.children[1] as Element;
    const lastLi = ul.children.at(-1) as Element;
    const marker = lastLi.children.at(-1) as Element;

    expect(lastLi.tagName).toBe("li");
    expect(marker.tagName).toBe(STREAMING_CURSOR_TAG);
  });

  it("anchors inside the last heading when content ends with one", () => {
    const tree: Root = {
      type: "root",
      children: [paragraph("contexto"), heading(2, "Seção nova")],
    };
    runPlugin(tree);

    const lastHeading = tree.children[1] as Element;
    const marker = lastHeading.children.at(-1) as Element;

    expect(lastHeading.tagName).toBe("h2");
    expect(marker.tagName).toBe(STREAMING_CURSOR_TAG);
  });

  it("is a no-op for empty roots", () => {
    const tree: Root = { type: "root", children: [] };
    runPlugin(tree);
    expect(tree.children).toHaveLength(0);
  });
});
