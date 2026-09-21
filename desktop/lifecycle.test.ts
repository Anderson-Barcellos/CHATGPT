import { describe, expect, it, vi } from "vitest";
import { DesktopLifecycle } from "./lifecycle";

describe("DesktopLifecycle", () => {
  it("esconde a janela até Sair encerrar explicitamente o backend", () => {
    const lifecycle = new DesktopLifecycle();
    const hideWindow = vi.fn();
    const stopBackend = vi.fn();

    expect(lifecycle.requestWindowClose(hideWindow)).toBe(false);
    expect(hideWindow).toHaveBeenCalledOnce();
    expect(stopBackend).not.toHaveBeenCalled();

    lifecycle.quit(stopBackend);
    expect(lifecycle.isQuitting).toBe(true);
    expect(stopBackend).toHaveBeenCalledOnce();
    expect(lifecycle.requestWindowClose(hideWindow)).toBe(true);
  });

  it("encerra uma vez quando a inicialização ou backend falha", () => {
    const lifecycle = new DesktopLifecycle();
    const stopBackend = vi.fn();
    const shutDownApplication = vi.fn();

    lifecycle.fail(stopBackend, shutDownApplication);
    lifecycle.fail(stopBackend, shutDownApplication);

    expect(lifecycle.isQuitting).toBe(true);
    expect(stopBackend).toHaveBeenCalledOnce();
    expect(shutDownApplication).toHaveBeenCalledOnce();
  });
});
