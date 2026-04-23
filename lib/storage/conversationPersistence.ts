import { ClientApiError } from "@/lib/api/errors";

const RETRY_DELAY_MS = 350;

function isRetryableConversationError(error: unknown): error is ClientApiError {
  return (
    error instanceof ClientApiError &&
    error.status >= 500 &&
    typeof error.code === "string" &&
    error.code.startsWith("conversation_")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withConversationPersistenceRetry<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!isRetryableConversationError(error)) {
      throw error;
    }

    await wait(RETRY_DELAY_MS);
    return action();
  }
}
