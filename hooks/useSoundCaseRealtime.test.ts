import { describe, expect, it, vi } from "vitest";
import type { SoundCaseSegment } from "@/lib/soundcase/types";
import {
  hasInboundRealtimeAudio,
  SoundCaseRealtimeQueue,
  SoundCaseRealtimeSessionFence,
} from "@/hooks/useSoundCaseRealtime";

const segments: SoundCaseSegment[] = [
  { id: "a", index: 0, start: 0, end: 5, text: "Texto um.", textHash: "h1" },
  { id: "b", index: 1, start: 6, end: 12, text: "Texto dois.", textHash: "h2" },
];

describe("SoundCase Realtime segmented queue", () => {
  it("sends exact segment text and advances only for matching done metadata", () => {
    const send = vi.fn();
    const indexes: number[] = [];
    const complete = vi.fn();
    const queue = new SoundCaseRealtimeQueue(send, (index) => indexes.push(index), complete);
    queue.reset(segments);
    queue.sendCurrent();
    const first = JSON.parse(send.mock.calls[0][0]);
    expect(first.response).not.toHaveProperty("instructions");
    expect(first.response.input[0].content[0].text).toBe("Texto um.");
    expect(first.response.metadata).toMatchObject({ generation: "1", segmentIndex: "0" });

    queue.handleDone({ status: "completed", metadata: { generation: "99", segmentIndex: "0" } });
    expect(send).toHaveBeenCalledTimes(1);
    queue.handleCreated({ id: "resp-1", metadata: { generation: "1", segmentIndex: "0" } });
    queue.handleDone({ id: "resp-1", status: "completed", metadata: { generation: "1", segmentIndex: "0" } });
    expect(JSON.parse(send.mock.calls[1][0]).response.input[0].content[0].text).toBe("Texto dois.");
    queue.handleDone({ status: "completed", metadata: { generation: "1", segmentIndex: "1" } });
    expect(complete).toHaveBeenCalledOnce();
    expect(indexes).toEqual([0, 1, 2]);
  });

  it("invalidates late done events after skipping", () => {
    const send = vi.fn();
    const queue = new SoundCaseRealtimeQueue(send, vi.fn(), vi.fn());
    queue.reset(segments);
    queue.sendCurrent();
    queue.handleCreated({ id: "resp-1", metadata: { generation: "1", segmentIndex: "0" } });
    queue.skipTo(1);
    expect(JSON.parse(send.mock.calls[1][0])).toEqual({ type: "response.cancel", response_id: "resp-1" });
    expect(JSON.parse(send.mock.calls[2][0])).toEqual({ type: "output_audio_buffer.clear" });
    expect(JSON.parse(send.mock.calls[3][0]).response.metadata).toMatchObject({ generation: "2", segmentIndex: "1" });
    queue.handleDone({ status: "cancelled", metadata: { generation: "1", segmentIndex: "0" } });
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("cancels a stale out-of-band response once its id arrives", () => {
    const send = vi.fn();
    const queue = new SoundCaseRealtimeQueue(send, vi.fn(), vi.fn());
    queue.reset(segments);
    queue.sendCurrent();
    queue.skipTo(1);
    queue.handleCreated({ id: "late-response", metadata: { generation: "1", segmentIndex: "0" } });
    expect(JSON.parse(send.mock.lastCall![0])).toEqual({
      type: "response.cancel", response_id: "late-response",
    });
  });

  it("aborts the old negotiation and rejects stale lifecycle callbacks", () => {
    const fence = new SoundCaseRealtimeSessionFence();
    const first = fence.start();
    const second = fence.start();
    expect(first.signal.aborted).toBe(true);
    expect(fence.isCurrent(first.id)).toBe(false);
    expect(fence.isCurrent(second.id)).toBe(true);
    fence.invalidate();
    expect(second.signal.aborted).toBe(true);
  });

  it("marks first audio only after inbound audio bytes exist", () => {
    expect(hasInboundRealtimeAudio({ type: "inbound-rtp", kind: "audio", bytesReceived: 0 })).toBe(false);
    expect(hasInboundRealtimeAudio({ type: "inbound-rtp", kind: "audio", bytesReceived: 64 })).toBe(true);
    expect(hasInboundRealtimeAudio({ type: "candidate-pair", bytesReceived: 64 })).toBe(false);
  });
});
