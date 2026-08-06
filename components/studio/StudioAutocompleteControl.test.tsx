import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudioAutocompleteControl } from "@/components/studio/StudioAutocompleteControl";

describe("StudioAutocompleteControl", () => {
  it.each([
    ["idle", "Autocomplete ligado"],
    ["requesting", "Autocomplete consultando"],
    ["cooldown", "Autocomplete em espera"],
    ["off", "Autocomplete desligado"],
  ] as const)("renders %s accessibly", (status, label) => {
    const markup = renderToStaticMarkup(
      <StudioAutocompleteControl
        enabled={status !== "off"}
        status={status}
        onToggle={vi.fn()}
      />
    );

    expect(markup).toContain(label);
    expect(markup).toContain('type="button"');
    expect(markup).toContain(`aria-pressed="${status !== "off"}"`);
    expect(markup).toContain("Autocomplete");
  });

  it("cannot toggle before the workspace preference is hydrated", () => {
    const markup = renderToStaticMarkup(
      <StudioAutocompleteControl
        enabled={false}
        status="off"
        disabled
        onToggle={vi.fn()}
      />
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-pressed="false"');
  });
});
