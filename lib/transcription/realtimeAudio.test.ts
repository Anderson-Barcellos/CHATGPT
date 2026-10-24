import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface Worklet {
  port: { onmessage: (event: { data: string }) => void };
  process: (inputs: Float32Array[][]) => boolean;
}
interface AudioEvent { type: string; buffer?: ArrayBuffer }

const createWorklet = (rate: number) => {
  const events: AudioEvent[] = [];
  let Processor: new () => Worklet;
  class AudioWorkletProcessor {
    port = { postMessage: (event: AudioEvent) => events.push(structuredClone(event)) };
  }
  runInNewContext(readFileSync(new URL('../../public/pcm-recorder.js', import.meta.url), 'utf8'), {
    AudioWorkletProcessor, sampleRate: rate,
    registerProcessor: (_name: string, processor: new () => Worklet) => { Processor = processor; },
  });
  const worklet = new Processor!();
  const feed = (seconds: number, amplitude: number, channels = 1) => {
    const length = Math.round(rate * seconds);
    for (let i = 0; i < length; i += 128) {
      const block = Float32Array.from({ length: Math.min(128, length - i) }, (_, j) => amplitude * Math.sin(2 * Math.PI * 440 * (i + j) / rate));
      worklet.process([Array.from({ length: channels }, () => block)]);
    }
  };
  return { worklet, events, feed };
};

describe('captura de PCM e detecção de pausa no AudioWorklet', () => {
  it.each([24000, 44100, 48000])('converte áudio a %i Hz para PCM16 mono a 24 kHz e envia a cauda antes do flush', (rate) => {
    const { worklet, events, feed } = createWorklet(rate);
    feed(1.25, 0.3, 2);
    worklet.port.onmessage({ data: 'stop' });
    const samples = events.filter((event) => event.type === 'audio').reduce((total, event) => total + event.buffer!.byteLength / 2, 0);
    expect(Math.abs(samples - 30000)).toBeLessThanOrEqual(1);
    expect(events.at(-1)?.type).toBe('flushed');
    for (const event of events.filter((event) => event.type === 'audio')) {
      expect(event.buffer!.byteLength % 2).toBe(0);
      expect(event.buffer!.byteLength).toBeLessThanOrEqual(4800);
    }
    expect(worklet.process([[new Float32Array(128)]])).toBe(false);
  });

  it('não envia silêncio como fala e mantém pré-captura ao começar a falar', () => {
    const { worklet, events, feed } = createWorklet(48000);
    feed(3, 0);
    expect(events).toHaveLength(0);
    feed(0.2, 0.3);
    expect(events.filter((event) => event.type === 'audio')).toHaveLength(5);
    worklet.port.onmessage({ data: 'stop' });
    expect(events.at(-1)?.type).toBe('flushed');
  });

  it('confirma uma vez por pausa e não continua confirmando silêncio', () => {
    const { events, feed } = createWorklet(24000);
    feed(1, 0.3);
    feed(3, 0);
    expect(events.filter((event) => event.type === 'commit')).toHaveLength(1);
    feed(1, 0.3);
    feed(1, 0);
    expect(events.filter((event) => event.type === 'commit')).toHaveLength(2);
  });

  it('limita trechos de fala contínua a 20 segundos', () => {
    const { events, feed } = createWorklet(24000);
    feed(21, 0.3);
    expect(events.filter((event) => event.type === 'commit')).toHaveLength(1);
  });
});
