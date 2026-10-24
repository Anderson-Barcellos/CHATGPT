// AudioWorklet: PCM16 mono a 24 kHz, em blocos de 100 ms. Não grava no disco.
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(2400);
    this.used = 0;
    this.position = 0;
    this.nextSample = 0;
    this.previous = 0;
    this.active = false;
    this.silence = 0;
    this.segment = 0;
    this.preroll = [];
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'stop') {
        this.stopped = true;
        if (this.used && this.active) this.emit(this.buffer.slice(0, this.used), true);
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }

  emit(pcm, flushing = false) {
    let energy = 0;
    for (const sample of pcm) energy += (sample / 32768) ** 2;
    const speech = Math.sqrt(energy / pcm.length) >= 0.008;
    if (!this.active && !speech && !flushing) {
      this.preroll.push(pcm);
      if (this.preroll.length > 3) this.preroll.shift();
      return;
    }
    if (!this.active) {
      for (const block of this.preroll) this.port.postMessage({ type: 'audio', buffer: block.buffer }, [block.buffer]);
      this.preroll = [];
      this.active = true;
    }
    this.port.postMessage({ type: 'audio', buffer: pcm.buffer }, [pcm.buffer]);
    this.segment += 100;
    this.silence = speech ? 0 : this.silence + 100;
    if (!flushing && (this.silence >= 800 || this.segment >= 20000)) {
      this.port.postMessage({ type: 'commit' });
      this.active = false;
      this.silence = 0;
      this.segment = 0;
    }
  }

  process(inputs) {
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const ratio = sampleRate / 24000;
    for (let i = 0; i < channels[0].length; i++) {
      let current = 0;
      for (const channel of channels) current += channel[i] / channels.length;
      while (this.nextSample <= this.position) {
        const fraction = 1 - (this.position - this.nextSample);
        const value = Math.max(-1, Math.min(1, this.previous + (current - this.previous) * fraction));
        this.buffer[this.used++] = Math.round(value * (value < 0 ? 32768 : 32767));
        if (this.used === this.buffer.length) {
          this.emit(this.buffer);
          this.buffer = new Int16Array(2400);
          this.used = 0;
        }
        this.nextSample += ratio;
      }
      this.previous = current;
      this.position++;
    }
    return true;
  }
}

registerProcessor('stt-pcm-recorder', PcmRecorder);
