import type { Monaco } from "@monaco-editor/react";
import type { editor, languages } from "monaco-editor";
import {
  STUDIO_AUTOCOMPLETE_DEBOUNCE_MS,
  STUDIO_AUTOCOMPLETE_TIMEOUT_MS,
  StudioAutocompleteFailureTracker,
  buildStudioAutocompleteContext,
  createStudioAutocompleteRequestKey,
  isStudioAutocompleteEligible,
  normalizeStudioAutocompleteCompletion,
  type StudioAutocompleteFinishReason,
  type StudioAutocompleteLanguage,
  type StudioAutocompleteRequest,
  type StudioAutocompleteResponse,
  type StudioAutocompleteStatus,
} from "@/lib/studio/autocomplete";
import { apiUrl } from "@/lib/utils";

const FINISH_REASONS = new Set<StudioAutocompleteFinishReason>([
  "stop",
  "length",
  "content_filter",
  "insufficient_system_resource",
]);

type StudioAutocompleteFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

interface ActiveRequest {
  key: string;
  controller: AbortController;
  promise: Promise<StudioAutocompleteResponse | null>;
}

export interface StudioAutocompleteRequestController {
  request(input: {
    key: string;
    request: StudioAutocompleteRequest;
  }): Promise<StudioAutocompleteResponse | null>;
  cancel(nextStatus?: StudioAutocompleteStatus): void;
  cancelRequest(key: string, nextStatus?: StudioAutocompleteStatus): void;
  dispose(): void;
}

export function createStudioAutocompleteRequestController(options: {
  fetchImpl?: StudioAutocompleteFetch;
  onStatusChange?: (status: StudioAutocompleteStatus) => void;
  onCooldownExpired?: () => void;
}): StudioAutocompleteRequestController {
  const fetchImpl = options.fetchImpl ?? fetch;
  const failures = new StudioAutocompleteFailureTracker();
  let active: ActiveRequest | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: StudioAutocompleteStatus) => {
    options.onStatusChange?.(status);
  };

  const clearCooldownTimer = () => {
    if (cooldownTimer) globalThis.clearTimeout(cooldownTimer);
    cooldownTimer = null;
  };

  const reportCooldown = () => {
    setStatus("cooldown");
    clearCooldownTimer();
    cooldownTimer = globalThis.setTimeout(() => {
      cooldownTimer = null;
      if (!active) setStatus("idle");
      options.onCooldownExpired?.();
    }, failures.cooldownRemainingMs());
  };

  const recordFailure = (retryAfterSeconds?: number) => {
    failures.recordFailure(retryAfterSeconds);
    if (failures.isCoolingDown()) reportCooldown();
    else setStatus("idle");
  };

  const parseResponse = (
    value: unknown
  ): StudioAutocompleteResponse | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Partial<StudioAutocompleteResponse>;
    if (
      typeof candidate.completion !== "string" ||
      !FINISH_REASONS.has(
        candidate.finishReason as StudioAutocompleteFinishReason
      )
    ) {
      return null;
    }

    return candidate as StudioAutocompleteResponse;
  };

  const request = (input: {
    key: string;
    request: StudioAutocompleteRequest;
  }): Promise<StudioAutocompleteResponse | null> => {
    if (failures.isCoolingDown()) {
      reportCooldown();
      return Promise.resolve(null);
    }

    if (active?.key === input.key) return active.promise;

    active?.controller.abort();
    const controller = new AbortController();
    let timedOut = false;
    const activeRequest: ActiveRequest = {
      key: input.key,
      controller,
      promise: Promise.resolve(null),
    };
    active = activeRequest;

    const promise = (async () => {
      const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, STUDIO_AUTOCOMPLETE_TIMEOUT_MS);
      setStatus("requesting");

      try {
        const response = await fetchImpl(
          apiUrl("/api/studio/autocomplete"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input.request),
            signal: controller.signal,
          }
        );

        if (active?.key !== input.key || controller.signal.aborted) return null;

        if (!response.ok) {
          let retryAfterSeconds: number | undefined;
          if (response.status === 429) {
            const parsed = Number.parseInt(
              response.headers.get("Retry-After") ?? "30",
              10
            );
            retryAfterSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
          }
          recordFailure(retryAfterSeconds);
          return null;
        }

        const payload = parseResponse(await response.json());
        if (!payload) {
          recordFailure();
          return null;
        }

        failures.recordSuccess();
        clearCooldownTimer();
        setStatus("idle");
        return payload;
      } catch (error) {
        if (active?.key !== input.key) return null;

        if (
          timedOut ||
          !(error instanceof Error && error.name === "AbortError")
        ) {
          recordFailure();
        } else {
          setStatus("idle");
        }
        return null;
      } finally {
        globalThis.clearTimeout(timeout);
        if (active?.key === input.key) active = null;
      }
    })();

    activeRequest.promise = promise;
    return promise;
  };

  const cancelActive = (
    nextStatus?: StudioAutocompleteStatus,
    expectedKey?: string
  ) => {
    if (expectedKey !== undefined && active?.key !== expectedKey) return;

    active?.controller.abort();
    active = null;

    if (nextStatus === "off") {
      clearCooldownTimer();
      setStatus("off");
    } else if (failures.isCoolingDown()) {
      reportCooldown();
    } else {
      setStatus(nextStatus ?? "idle");
    }
  };

  return {
    request,
    cancel(nextStatus) {
      cancelActive(nextStatus);
    },
    cancelRequest(key, nextStatus) {
      cancelActive(nextStatus, key);
    },
    dispose() {
      clearCooldownTimer();
      active?.controller.abort();
      active = null;
    },
  };
}

export interface StudioAutocompleteProviderHandle {
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function registerStudioAutocompleteProvider(options: {
  monaco: Monaco;
  editor: editor.IStandaloneCodeEditor;
  isEnabled: () => boolean;
  isDesktop: () => boolean;
  getFilePath: () => string;
  // Contexto extra prependido ao prefixo do FIM (ex.: células anteriores de
  // um notebook); a truncagem padrão do contexto continua valendo.
  getLeadingContext?: () => string;
  onStatusChange?: (status: StudioAutocompleteStatus) => void;
  fetchImpl?: StudioAutocompleteFetch;
}): StudioAutocompleteProviderHandle {
  const { editor: instance, monaco } = options;
  let composing = false;
  let chainTimer: ReturnType<typeof setTimeout> | null = null;

  const trigger = () => {
    instance.trigger(
      "studio.autocomplete",
      "editor.action.inlineSuggest.trigger",
      null
    );
  };

  const clearChainTimer = () => {
    if (chainTimer) globalThis.clearTimeout(chainTimer);
    chainTimer = null;
  };

  const requests = createStudioAutocompleteRequestController({
    fetchImpl: options.fetchImpl,
    onStatusChange: options.onStatusChange,
    onCooldownExpired: () => {
      if (options.isEnabled() && options.isDesktop()) trigger();
    },
  });

  const acceptCommandId = instance.addCommand(0, () => {
    clearChainTimer();
    chainTimer = globalThis.setTimeout(
      trigger,
      STUDIO_AUTOCOMPLETE_DEBOUNCE_MS
    );
  });

  const provider: languages.InlineCompletionsProvider = {
      debounceDelayMs: STUDIO_AUTOCOMPLETE_DEBOUNCE_MS,
      async provideInlineCompletions(model, position, _context, token) {
        const selection = instance.getSelection();
        if (
          !isStudioAutocompleteEligible({
            enabled: options.isEnabled(),
            desktop: options.isDesktop(),
            focused: instance.hasTextFocus(),
            selectionEmpty: Boolean(selection?.isEmpty()),
            composing,
            language: model.getLanguageId(),
          })
        ) {
          return { items: [] };
        }

        const leadingContext = options.getLeadingContext?.() ?? "";
        const context = buildStudioAutocompleteContext(
          leadingContext + model.getValue(),
          leadingContext.length + model.getOffsetAt(position)
        );
        const key = createStudioAutocompleteRequestKey({
          uri: model.uri.toString(),
          version: model.getVersionId(),
          lineNumber: position.lineNumber,
          column: position.column,
          ...context,
        });
        const cancellation = token.onCancellationRequested(() => {
          requests.cancelRequest(
            key,
            options.isEnabled() ? undefined : "off"
          );
        });
        const payload = await requests.request({
          key,
          request: {
            filePath: options.getFilePath(),
            language: model.getLanguageId() as StudioAutocompleteLanguage,
            ...context,
          },
        });
        cancellation.dispose();

        if (!payload) return { items: [] };

        const currentPosition = instance.getPosition();
        if (!currentPosition) return { items: [] };

        const currentSelection = instance.getSelection();
        if (
          !isStudioAutocompleteEligible({
            enabled: options.isEnabled(),
            desktop: options.isDesktop(),
            focused: instance.hasTextFocus(),
            selectionEmpty: Boolean(currentSelection?.isEmpty()),
            composing,
            language: model.getLanguageId(),
          })
        ) {
          return { items: [] };
        }

        const currentContext = buildStudioAutocompleteContext(
          model.getValue(),
          model.getOffsetAt(currentPosition)
        );
        const currentKey = createStudioAutocompleteRequestKey({
          uri: model.uri.toString(),
          version: model.getVersionId(),
          lineNumber: currentPosition.lineNumber,
          column: currentPosition.column,
          ...currentContext,
        });
        if (currentKey !== key) return { items: [] };

        const line = model.getLineContent(position.lineNumber);
        const completion = normalizeStudioAutocompleteCompletion(
          payload.completion,
          payload.finishReason,
          position.column === line.length + 1
        );
        if (!completion) return { items: [] };

        return {
          items: [
            {
              insertText: completion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              ...(acceptCommandId
                ? {
                    command: {
                      id: acceptCommandId,
                      title: "Continuar autocomplete",
                    },
                  }
                : {}),
            },
          ],
        };
      },
      disposeInlineCompletions() {},
    };
  const registration = monaco.languages.registerInlineCompletionsProvider(
    ["typescript", "javascript", "python"],
    provider
  );

  const cancelStaleRequest = () => {
    clearChainTimer();
    requests.cancel(options.isEnabled() ? undefined : "off");
  };
  const disposables = [
    instance.onDidChangeModelContent(cancelStaleRequest),
    instance.onDidChangeCursorPosition(cancelStaleRequest),
    instance.onDidChangeCursorSelection(cancelStaleRequest),
    instance.onDidChangeModel(cancelStaleRequest),
    instance.onDidCompositionStart(() => {
      composing = true;
      cancelStaleRequest();
    }),
    instance.onDidCompositionEnd(() => {
      composing = false;
    }),
  ];

  options.onStatusChange?.(
    options.isEnabled() && options.isDesktop() ? "idle" : "off"
  );

  return {
    setEnabled(enabled) {
      clearChainTimer();
      if (!enabled || !options.isDesktop()) {
        requests.cancel("off");
        instance.trigger(
          "studio.autocomplete",
          "editor.action.inlineSuggest.hide",
          null
        );
      } else if (options.isDesktop()) {
        options.onStatusChange?.("idle");
        trigger();
      }
    },
    dispose() {
      clearChainTimer();
      requests.dispose();
      for (const disposable of disposables) disposable.dispose();
      registration.dispose();
    },
  };
}
