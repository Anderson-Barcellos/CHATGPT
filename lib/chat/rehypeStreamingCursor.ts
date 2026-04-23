import type { Element, Root, RootContent } from "hast";

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "td",
  "th",
  "pre",
]);

const CONTAINER_TAGS = new Set([
  "ul",
  "ol",
  "div",
  "section",
  "article",
  "table",
  "thead",
  "tbody",
  "tr",
]);

function findLastTextualBlock(node: Element | Root): Element | null {
  const children = node.children as RootContent[];
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child.type !== "element") continue;

    if (CONTAINER_TAGS.has(child.tagName)) {
      const deeper = findLastTextualBlock(child);
      if (deeper) return deeper;
      continue;
    }

    if (BLOCK_TAGS.has(child.tagName)) {
      const deeper = findLastTextualBlock(child);
      return deeper ?? child;
    }
  }
  return null;
}

export const STREAMING_CURSOR_TAG = "streaming-cursor";

export function rehypeStreamingCursor() {
  return (tree: Root) => {
    const target = findLastTextualBlock(tree);
    if (!target) return;
    target.children.push({
      type: "element",
      tagName: STREAMING_CURSOR_TAG,
      properties: {},
      children: [],
    });
  };
}
