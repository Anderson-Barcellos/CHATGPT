import { describe, expect, it } from "vitest";
import {
  StudioAutocompleteFailureTracker,
  buildStudioAutocompleteContext,
  createStudioAutocompleteRequestKey,
  isStudioAutocompleteEligible,
  normalizeStudioAutocompleteCompletion,
} from "@/lib/studio/autocomplete";

describe("Studio autocomplete rules", () => {
  it("uses the whole script through 32k characters", () => {
    const source = `${"a".repeat(10_000)}CURSOR${"b".repeat(10_000)}`;
    const context = buildStudioAutocompleteContext(source, 10_000);

    expect(context.prefix).toBe("a".repeat(10_000));
    expect(context.suffix).toBe(`CURSOR${"b".repeat(10_000)}`);
  });

  it("caps a large script at 24k before and 8k after the cursor", () => {
    const source = `${"a".repeat(30_000)}${"b".repeat(20_000)}`;
    const context = buildStudioAutocompleteContext(source, 30_000);

    expect(context.prefix).toHaveLength(24_000);
    expect(context.suffix).toHaveLength(8_000);
    expect(context.prefix).toBe("a".repeat(24_000));
    expect(context.suffix).toBe("b".repeat(8_000));
  });

  it.each([
    [{ enabled: false }, false],
    [{ desktop: false }, false],
    [{ focused: false }, false],
    [{ selectionEmpty: false }, false],
    [{ composing: true }, false],
    [{ language: "json" }, false],
    [{ language: "typescript" }, true],
    [{ language: "javascript" }, true],
  ])("evaluates eligibility for %o", (override, expected) => {
    expect(
      isStudioAutocompleteEligible({
        enabled: true,
        desktop: true,
        focused: true,
        selectionEmpty: true,
        composing: false,
        language: "typescript",
        ...override,
      })
    ).toBe(expected);
  });

  it("invalidates a request when URI, version, position or context changes", () => {
    const base = {
      uri: "file:///src/index.ts",
      version: 3,
      lineNumber: 2,
      column: 4,
      prefix: "const a = ",
      suffix: ";",
    };
    const key = createStudioAutocompleteRequestKey(base);

    expect(createStudioAutocompleteRequestKey(base)).toBe(key);
    expect(
      createStudioAutocompleteRequestKey({
        ...base,
        uri: "file:///src/outro.ts",
      })
    ).not.toBe(key);
    expect(
      createStudioAutocompleteRequestKey({ ...base, version: 4 })
    ).not.toBe(key);
    expect(
      createStudioAutocompleteRequestKey({ ...base, lineNumber: 3 })
    ).not.toBe(key);
    expect(
      createStudioAutocompleteRequestKey({ ...base, column: 5 })
    ).not.toBe(key);
    expect(
      createStudioAutocompleteRequestKey({ ...base, prefix: "let a = " })
    ).not.toBe(key);
  });

  it("keeps multiline completions only at line end", () => {
    expect(
      normalizeStudioAutocompleteCompletion(
        "foo();\nbar();",
        "stop",
        true
      )
    ).toBe("foo();\nbar();");
    expect(
      normalizeStudioAutocompleteCompletion(
        "foo();\nbar();",
        "stop",
        false
      )
    ).toBe("foo();");
  });

  it("uses the first non-empty line when the cursor is midline", () => {
    expect(
      normalizeStudioAutocompleteCompletion(
        "\n  primeiro();\nsegundo();",
        "stop",
        false
      )
    ).toBe("  primeiro();");
  });

  it.each(["", "   ", "```ts\nfoo();\n```", "```javascript"])(
    "discards empty or fenced output %j",
    (completion) => {
      expect(
        normalizeStudioAutocompleteCompletion(completion, "stop", true)
      ).toBeNull();
    }
  );

  it.each([
    "length",
    "content_filter",
    "insufficient_system_resource",
  ] as const)("discards non-terminal finish reason %s", (finishReason) => {
    expect(
      normalizeStudioAutocompleteCompletion("foo()", finishReason, true)
    ).toBeNull();
  });

  it("enters cooldown after three failures and resets on success", () => {
    let now = 1_000;
    const tracker = new StudioAutocompleteFailureTracker(() => now);

    tracker.recordFailure();
    tracker.recordFailure();
    expect(tracker.isCoolingDown()).toBe(false);
    tracker.recordFailure();
    expect(tracker.isCoolingDown()).toBe(true);
    now += 30_001;
    expect(tracker.isCoolingDown()).toBe(false);
    tracker.recordSuccess();
    expect(tracker.consecutiveFailures).toBe(0);
    expect(tracker.cooldownRemainingMs()).toBe(0);
  });

  it("respects Retry-After immediately", () => {
    let now = 5_000;
    const tracker = new StudioAutocompleteFailureTracker(() => now);

    tracker.recordFailure(12);
    expect(tracker.cooldownRemainingMs()).toBe(12_000);
    now += 12_001;
    expect(tracker.isCoolingDown()).toBe(false);
  });
});
