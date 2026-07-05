import { describe, expect, it } from "vitest";
import { derivePulseRunTitle } from "@/lib/pulse/runTitle";

describe("derivePulseRunTitle", () => {
  it("uses the first markdown heading as the run title", () => {
    expect(
      derivePulseRunTitle(
        "## Psilocibina e plasticidade cortical\n\nTexto do relatorio.",
        "Rotina semanal"
      )
    ).toBe("Psilocibina e plasticidade cortical");
  });

  it("uses the first meaningful content line when there is no heading", () => {
    expect(
      derivePulseRunTitle(
        "![abertura](imagem.png)\n\n**Um ensaio clinico muda o debate sobre depressao resistente.** O estudo compara estrategias.",
        "Neuro semanal"
      )
    ).toBe("Um ensaio clinico muda o debate sobre depressao resistente.");
  });

  it("falls back to the routine title when content is empty", () => {
    expect(derivePulseRunTitle("", "Neuro semanal")).toBe("Neuro semanal");
  });
});
