import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationItem } from "@/components/sidebar/SidebarModern";

describe("ConversationItem", () => {
  const conversation = {
    id: "conv-1",
    title: "Conversa acessivel",
    messages: [],
    createdAt: new Date("2026-04-23T12:00:00.000Z"),
    updatedAt: new Date("2026-04-23T12:00:00.000Z"),
  };

  it("renders the conversation row as a keyboard-focusable button", () => {
    const markup = renderToStaticMarkup(
      <ConversationItem
        conversation={conversation}
        isActive={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain("<button");
    expect(markup).toContain('type="button"');
    expect(markup).toContain("Conversa acessivel");
  });

  it("marks disabled conversation rows as disabled controls", () => {
    const markup = renderToStaticMarkup(
      <ConversationItem
        conversation={conversation}
        isActive={false}
        disabled
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-disabled="true"');
  });
});
