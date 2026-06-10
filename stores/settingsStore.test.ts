import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";

const initialState = useSettingsStore.getState();

describe("settings store model defaults", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      parameters: { ...initialState.parameters },
      modelSettingsById: { ...initialState.modelSettingsById },
      customInstructions: null,
      memories: [],
    });
  });

  it("uses GPT-5.4 mini as the chat default", () => {
    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.4-mini");
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults full reasoning models to medium reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.2" });

    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("medium");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("defaults mini models to no reasoning", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.4-mini" });
    expect(useSettingsStore.getState().parameters.reasoningEffort).toBe("none");
    expect(useSettingsStore.getState().parameters.reasoningSummary).toBe("detailed");
  });

  it("falls legacy removed models back to the current default", () => {
    useSettingsStore.getState().updateParameters({ model: "gpt-5.1" });

    expect(useSettingsStore.getState().parameters.model).toBe("gpt-5.4-mini");
  });
});
