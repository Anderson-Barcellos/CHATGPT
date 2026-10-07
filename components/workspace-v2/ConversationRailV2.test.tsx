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
  it("offers SoundCase, Descobrir IA e Studio no rodapé", () => {
    const markup = renderToStaticMarkup(<ConversationRailV2 onOpenSettings={() => undefined} />);

    expect(markup).toContain("Abrir SoundCase");
    expect(markup).toContain("Descobrir IA");
    expect(markup).toContain("Abrir Studio");
    expect(markup.match(/href="\/soundcase"/g)).toHaveLength(1);
    const [soundcase, discover, studio] = linkOrder(markup, ["/soundcase", "/discover", "/studio"]);
    expect(soundcase).toBeGreaterThan(-1);
    expect(soundcase).toBeLessThan(discover);
    expect(discover).toBeLessThan(studio);
  });

  it("keeps the same order in the compact rail", () => {
    const markup = renderToStaticMarkup(
      <ConversationRailV2 onOpenSettings={() => undefined} compact />
    );

    expect(markup).toContain('title="Abrir SoundCase"');
    expect(markup.match(/href="\/soundcase"/g)).toHaveLength(1);
    expect(markup).toContain('title="Abrir Gaucho Studio"');
    const [soundcase, discover, studio] = linkOrder(markup, ["/soundcase", "/discover", "/studio"]);
    expect(soundcase).toBeGreaterThan(-1);
    expect(soundcase).toBeLessThan(discover);
    expect(discover).toBeLessThan(studio);
  });
});
