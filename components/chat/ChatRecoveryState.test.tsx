import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatRecoveryState } from "@/components/chat/ChatRecoveryState";

describe("ChatRecoveryState", () => {
  it("renders a recoverable error with a retry action label", () => {
    const markup = renderToStaticMarkup(
      <ChatRecoveryState
        error="Nao consegui carregar esta conversa agora."
        isRecovering={false}
        onRetry={() => undefined}
      />
    );

    expect(markup).toContain("Nao consegui recuperar o chat");
    expect(markup).toContain("Recarregar conversas");
    expect(markup).toContain("Nao consegui carregar esta conversa agora.");
  });

  it("renders the loading copy while recovery is in progress", () => {
    const markup = renderToStaticMarkup(
      <ChatRecoveryState
        error={null}
        isRecovering={true}
        onRetry={() => undefined}
      />
    );

    expect(markup).toContain("Preparando teu workspace");
  });
});
