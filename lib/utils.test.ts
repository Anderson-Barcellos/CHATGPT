import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn com a régua tipográfica do shell", () => {
  it("não confunde tamanho customizado com cor", () => {
    expect(cn("text-nano text-muted-foreground")).toBe("text-nano text-muted-foreground");
    expect(cn("text-primary-foreground", "text-micro")).toBe("text-primary-foreground text-micro");
  });

  it("deixa o último tamanho vencer, misturando Tailwind e tokens", () => {
    expect(cn("text-xs", "text-caption")).toBe("text-caption");
    expect(cn("text-body-sm md:text-body", "text-caption md:text-body-sm")).toBe("text-caption md:text-body-sm");
    expect(cn("text-nano", "text-sm")).toBe("text-sm");
  });
});
