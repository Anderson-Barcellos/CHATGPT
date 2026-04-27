import { afterEach, describe, expect, it, vi } from "vitest";
import { createAttachmentId } from "@/lib/chat/attachmentIds";

const originalCrypto = globalThis.crypto;

describe("createAttachmentId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("uses crypto.randomUUID when available", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: vi.fn(() => "uuid-from-crypto"),
      },
    });

    expect(createAttachmentId()).toBe("uuid-from-crypto");
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back to a local attachment id when randomUUID is unavailable", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_775_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });

    expect(createAttachmentId()).toMatch(/^attachment-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("returns a non-empty fallback id with a stable prefix", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });

    const id = createAttachmentId();

    expect(id).toEqual(expect.stringMatching(/^attachment-/));
    expect(id.length).toBeGreaterThan("attachment-".length);
  });
});
