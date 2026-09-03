import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getChatMessageRenderKey } from "@/components/chat/ChatContainer";
import { ChatContainer } from "@/components/chat/ChatContainer";
import type { Message } from "@/types";

describe("getChatMessageRenderKey", () => {
  it("keeps the assistant bubble mounted when an artifact is attached", () => {
    const baseMessage: Message = {
      id: "assistant-1",
      role: "assistant",
      content: "Texto em stream",
      timestamp: new Date("2026-04-28T12:00:00.000Z"),
      streamStatus: "streaming",
    };

    const completedWithArtifact: Message = {
      ...baseMessage,
      content: "Resumo do documento",
      streamStatus: "completed",
      artifact: {
        id: "artifact-1",
        kind: "document",
        title: "Documento",
        summary: "Resumo do documento",
        displayMode: "document",
        content: "# Documento\n\nTexto final",
        type: "markdown",
      },
    };

    expect(getChatMessageRenderKey(baseMessage)).toBe("assistant-1");
    expect(getChatMessageRenderKey(completedWithArtifact)).toBe("assistant-1");
  });
});

describe("ChatContainer welcome", () => {
  it("renders real recent conversations without clinical placeholders", () => {
    const markup = renderToStaticMarkup(
      <ChatContainer
        messages={[]}
        isLoading={false}
        editAndResend={async () => undefined}
        deleteMessage={async () => undefined}
        activeConversationId="conversation-1"
        recentConversations={[
          {
            id: "conversation-1",
            title: "Minha conversa real",
            updatedAt: new Date("2026-08-22T12:00:00.000Z"),
          },
        ]}
        onSelectConversation={() => undefined}
        onOpenConversations={() => undefined}
      />
    );

    expect(markup).toContain("Minha conversa real");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Olá, Anders.");
    expect(markup).toContain("No que posso te ajudar?");
    expect(markup).not.toContain("Paciente João Silva");
    expect(markup).not.toContain("09:21");
  });

  it("shows an honest empty state when no conversation exists", () => {
    const markup = renderToStaticMarkup(
      <ChatContainer
        messages={[]}
        isLoading={false}
        editAndResend={async () => undefined}
        deleteMessage={async () => undefined}
        activeConversationId={null}
        recentConversations={[]}
        onSelectConversation={() => undefined}
        onOpenConversations={() => undefined}
      />
    );

    expect(markup).toContain("Tuas conversas recentes vão aparecer aqui.");
  });
});
