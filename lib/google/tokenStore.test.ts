import { describe, expect, it } from "vitest";
import {
  decryptTokenValue,
  deriveGoogleTokenEncryptionKey,
  encryptTokenValue,
} from "@/lib/google/tokenStore";

describe("google token encryption", () => {
  it("encrypts token values without leaving plaintext in the payload", () => {
    const key = deriveGoogleTokenEncryptionKey("test-encryption-secret");
    const encrypted = encryptTokenValue("refresh-token-secret", key);

    expect(encrypted).not.toContain("refresh-token-secret");
    expect(decryptTokenValue(encrypted, key)).toBe("refresh-token-secret");
  });
});
