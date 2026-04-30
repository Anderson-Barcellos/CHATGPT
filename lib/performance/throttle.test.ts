import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle } from "@/lib/performance/throttle";

describe("createThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the function immediately on first call", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 1000);

    t.call("a");

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("collapses bursts of calls into one trailing invocation", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 1000);

    t.call("a");
    t.call("b");
    t.call("c");
    t.call("d");

    expect(fn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("d");
  });

  it("flushes pending arguments synchronously", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 1000);

    t.call("first");
    t.call("second");
    t.flush();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("second");
  });

  it("cancel discards pending invocations", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 1000);

    t.call("first");
    t.call("second");
    t.cancel();

    vi.advanceTimersByTime(2000);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("first");
  });
});
