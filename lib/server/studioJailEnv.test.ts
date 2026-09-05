import { describe, expect, it } from "vitest";
import { buildJailParentEnv, hasJailOpenAIKey } from "@/lib/server/studioJailEnv";

describe("studio jail env", () => {
  it("replaces the main OpenAI key with the scoped Studio key", () => {
    const env = buildJailParentEnv({
      NODE_ENV: "test",
      OPENAI_API_KEY: "sk-principal",
      STUDIO_OPENAI_API_KEY: " sk-jail ",
      PATH: "/usr/bin",
    });
    expect(env.OPENAI_API_KEY).toBe("sk-jail");
    expect(env.STUDIO_OPENAI_API_KEY).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
    expect(hasJailOpenAIKey({ NODE_ENV: "test", STUDIO_OPENAI_API_KEY: "sk-jail" })).toBe(true);
  });

  it("strips the main key entirely when no scoped key is configured", () => {
    const env = buildJailParentEnv({ NODE_ENV: "test", OPENAI_API_KEY: "sk-principal", STUDIO_OPENAI_API_KEY: "  " });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(hasJailOpenAIKey({ NODE_ENV: "test", OPENAI_API_KEY: "sk-principal" })).toBe(false);
  });
});
