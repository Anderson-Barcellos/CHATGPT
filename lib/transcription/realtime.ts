export const REALTIME_TRANSCRIPTION_MODEL = 'gpt-live-transcribe';
export const REALTIME_TRANSCRIPTION_PATH = '/api/transcribe/realtime';
export const REALTIME_SAMPLE_RATE = 24000;

export const realtimeSessionUpdate = () => ({
  type: 'session.update',
  session: {
    type: 'transcription',
    audio: {
      input: {
        format: { type: 'audio/pcm', rate: REALTIME_SAMPLE_RATE },
        transcription: {
          model: REALTIME_TRANSCRIPTION_MODEL,
          languages: ['pt'],
          prompt: 'Ditado em português brasileiro para mensagens e notas pessoais.',
          delay: 'low',
        },
        turn_detection: null,
        noise_reduction: { type: 'near_field' },
      },
    },
  },
});

// O texto final substitui os deltas do mesmo item; conclusões podem chegar fora de ordem.
export class RealtimeTranscript {
  private order: string[] = [];
  private items = new Map<string, { text: string; completed: boolean }>();

  update(event: Record<string, unknown>): boolean {
    const id = event.item_id;
    if (typeof id !== 'string') return false;
    if (event.type === 'input_audio_buffer.committed') {
      this.order = this.order.filter((item) => item !== id);
      const previous = event.previous_item_id;
      const index = typeof previous === 'string' ? this.order.indexOf(previous) : -1;
      if (previous === null || index >= 0) this.order.splice(index + 1, 0, id);
      else this.order.push(id);
      return true;
    }
    if (!this.order.includes(id)) this.order.push(id);
    const item = this.items.get(id) ?? { text: '', completed: false };
    if (event.type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      if (!item.completed) item.text += event.delta;
    } else if (event.type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      item.text = event.transcript;
      item.completed = true;
    } else return false;
    this.items.set(id, item);
    return true;
  }

  get text(): string {
    return this.order.map((id) => this.items.get(id)?.text.trim() ?? '').filter(Boolean).join(' ');
  }
}
