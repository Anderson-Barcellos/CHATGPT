export interface ThrottleHandle<T extends unknown[]> {
  call: (...args: T) => void;
  flush: () => void;
  cancel: () => void;
}

export function createThrottle<T extends unknown[]>(
  fn: (...args: T) => void,
  intervalMs: number
): ThrottleHandle<T> {
  let lastInvocation = 0;
  let pendingArgs: T | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const invoke = () => {
    timeout = null;
    if (!pendingArgs) return;
    lastInvocation = Date.now();
    const args = pendingArgs;
    pendingArgs = null;
    fn(...args);
  };

  return {
    call(...args: T) {
      pendingArgs = args;
      const elapsed = Date.now() - lastInvocation;
      if (elapsed >= intervalMs) {
        invoke();
      } else if (!timeout) {
        timeout = setTimeout(invoke, intervalMs - elapsed);
      }
    },
    flush() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (pendingArgs) invoke();
    },
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      pendingArgs = null;
    },
  };
}
