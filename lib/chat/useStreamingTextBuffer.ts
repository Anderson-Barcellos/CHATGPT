"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageStreamStatus } from "@/types";

export const STREAMING_BUFFER_CURSOR_HOLD_MS = 1120;

export function getStreamingBufferStepSize(pendingChars: number): number {
  if (pendingChars > 420) return 20;
  if (pendingChars > 240) return 12;
  if (pendingChars > 140) return 7;
  if (pendingChars > 72) return 4;
  if (pendingChars > 28) return 2;
  return 1;
}

export function getStreamingBufferStepDelay(pendingChars: number): number {
  if (pendingChars > 420) return 14;
  if (pendingChars > 240) return 18;
  if (pendingChars > 140) return 22;
  if (pendingChars > 72) return 28;
  if (pendingChars > 28) return 36;
  return 48;
}

interface UseStreamingTextBufferOptions {
  content: string;
  streamStatus?: MessageStreamStatus;
}

interface UseStreamingTextBufferResult {
  displayed: string;
  isSettling: boolean;
}

export function useStreamingTextBuffer({
  content,
  streamStatus,
}: UseStreamingTextBufferOptions): UseStreamingTextBufferResult {
  const isStreamingStart = streamStatus === "streaming";
  const initialDisplayed = isStreamingStart ? "" : content;

  const [displayed, setDisplayed] = useState(initialDisplayed);
  const [isSettling, setIsSettling] = useState(false);

  const targetRef = useRef(content);
  const displayedRef = useRef(initialDisplayed);
  const timerRef = useRef<number | null>(null);
  const cursorHoldUntilRef = useRef(0);
  const streamCompleteRef = useRef(!isStreamingStart);

  useEffect(() => {
    const pump = () => {
      timerRef.current = null;

      const pending =
        targetRef.current.length - displayedRef.current.length;

      if (pending <= 0) {
        if (!streamCompleteRef.current) return;

        setIsSettling(true);

        if (Date.now() < cursorHoldUntilRef.current) {
          timerRef.current = window.setTimeout(pump, 48);
          return;
        }

        setIsSettling(false);
        return;
      }

      const stepSize = getStreamingBufferStepSize(pending);
      const nextLength = displayedRef.current.length + stepSize;
      const nextDisplayed = targetRef.current.slice(0, nextLength);
      displayedRef.current = nextDisplayed;
      setDisplayed(nextDisplayed);
      cursorHoldUntilRef.current =
        Date.now() + STREAMING_BUFFER_CURSOR_HOLD_MS;

      timerRef.current = window.setTimeout(
        pump,
        getStreamingBufferStepDelay(pending)
      );
    };

    targetRef.current = content;
    streamCompleteRef.current = streamStatus !== "streaming";

    if (timerRef.current !== null) return;

    const hasPending = targetRef.current.length > displayedRef.current.length;
    const needsSettling =
      streamCompleteRef.current &&
      Date.now() < cursorHoldUntilRef.current;

    if (hasPending || needsSettling) {
      timerRef.current = window.setTimeout(pump, 0);
    }
  }, [content, streamStatus]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  return { displayed, isSettling };
}
