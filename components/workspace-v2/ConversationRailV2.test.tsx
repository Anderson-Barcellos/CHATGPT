import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationRailV2 } from "@/components/workspace-v2/ConversationRailV2";

vi.mock("@/hooks/useConversations", () => ({
  useConversations: () => ({
    conversations: [],
    isLoading: false,
    error: null,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }),
}));

function linkOrder(markup: string, hrefs: string[]): number[] {
  return hrefs.map((href) => markup.indexOf(`href="${href}"`));
}

describe("ConversationRailV2 product links", () => {
  it("offers a single SoundCase entry above Studio in the footer", () => {
    const markup = renderToStaticMarkup(<ConversationRailV2 onOpenSettings={() => undefined} />);

    expect(markup).toContain("Abrir SoundCase");
    expect(markup).toContain("Abrir Studio");
    expect(markup.match(/href="\/soundcase"/g)).toHaveLength(1);
    const [soundcase, studio] = linkOrder(markup, ["/soundcase", "/studio"]);
    expect(soundcase).toBeGreaterThan(-1);
    expect(soundcase).toBeLessThan(studio);
  });

  it("keeps the same order in the compact rail", () => {
    const markup = renderToStaticMarkup(
      <ConversationRailV2 onOpenSettings={() => undefined} compact />
    );

    expect(markup).toContain('title="Abrir SoundCase"');
    expect(markup.match(/href="\/soundcase"/g)).toHaveLength(1);
    const [soundcase, studio] = linkOrder(markup, ["/soundcase", "/studio"]);
    expect(soundcase).toBeGreaterThan(-1);
    expect(soundcase).toBeLessThan(studio);
  });
});
