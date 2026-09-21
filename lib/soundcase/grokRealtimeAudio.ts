export const GROK_REALTIME_SAMPLE_RATE = 24_000;

export function decodePcm16(buffer: ArrayBuffer): Float32Array {
  const input = new DataView(buffer);
  const samples = new Float32Array(Math.floor(buffer.byteLength / 2));
  for (let index = 0; index < samples.length; index += 1) samples[index] = input.getInt16(index * 2, true) / 32_768;
  return samples;
}

/** Agenda PCM recebido numa única linha do tempo e pode invalidar todo áudio tardio. */
export class SoundCasePcmPlayer {
  private cursor = 0;
  private generation = 0;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly drainWaiters = new Set<() => void>();

  constructor(private readonly context: AudioContext) {}

  clear(): void {
    this.generation += 1;
    this.cursor = this.context.currentTime;
    for (const source of this.sources) source.stop();
    this.sources.clear();
    this.notifyDrained();
  }

  enqueue(buffer: ArrayBuffer, expectedGeneration = this.generation): void {
    if (expectedGeneration !== this.generation || buffer.byteLength < 2) return;
    const samples = decodePcm16(buffer);
    const audio = this.context.createBuffer(1, samples.length, GROK_REALTIME_SAMPLE_RATE);
    audio.copyToChannel(new Float32Array(samples), 0);
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.context.destination);
    const startAt = Math.max(this.context.currentTime + 0.02, this.cursor);
    this.cursor = startAt + audio.duration;
    this.sources.add(source);
    source.addEventListener("ended", () => { this.sources.delete(source); if (!this.sources.size) this.notifyDrained(); }, { once: true });
    source.start(startAt);
  }

  get currentGeneration(): number { return this.generation; }

  async drained(): Promise<void> {
    if (!this.sources.size) return;
    await new Promise<void>((resolve) => this.drainWaiters.add(resolve));
  }

  private notifyDrained(): void {
    for (const resolve of this.drainWaiters) resolve();
    this.drainWaiters.clear();
  }
}
