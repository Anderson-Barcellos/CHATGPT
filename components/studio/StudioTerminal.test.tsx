import { describe, expect, it } from "vitest";
import { terminalStatusLabel } from "@/components/studio/StudioTerminal";

describe("terminalStatusLabel", () => {
  it("labels the live session states", () => {
    expect(
      terminalStatusLabel({ status: "connecting", exitReason: null, error: null })
    ).toBe("Conectando…");
    expect(
      terminalStatusLabel({ status: "open", exitReason: null, error: null })
    ).toBe("Sessão ativa");
  });

  it("distinguishes idle-kill from a manual close", () => {
    expect(
      terminalStatusLabel({ status: "closed", exitReason: "idle", error: null })
    ).toBe("Sessão encerrada por inatividade");
    expect(
      terminalStatusLabel({ status: "closed", exitReason: "closed", error: null })
    ).toBe("Sessão encerrada");
    expect(
      terminalStatusLabel({ status: "closed", exitReason: "exited", error: null })
    ).toBe("Sessão finalizada");
  });

  it("surfaces the server error message when there is one", () => {
    expect(
      terminalStatusLabel({
        status: "error",
        exitReason: null,
        error: "O terminal já está aberto em outra aba.",
      })
    ).toBe("O terminal já está aberto em outra aba.");
  });
});
