import { describe, expect, it } from 'vitest';
import { RealtimeTranscript, realtimeSessionUpdate } from './realtime';

describe('transcrição incremental', () => {
  it('ordena trechos pelo áudio e substitui os deltas pelo texto final, sem duplicar', () => {
    const transcript = new RealtimeTranscript();
    transcript.update({ type: 'input_audio_buffer.committed', item_id: 'a', previous_item_id: null });
    transcript.update({ type: 'input_audio_buffer.committed', item_id: 'b', previous_item_id: 'a' });
    transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Fígado ' });
    transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'normal.' });
    expect(transcript.text).toBe('Fígado normal.');
    transcript.update({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'b', transcript: 'Rins normais.' });
    transcript.update({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'Fígado sem alterações.' });
    transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'atrasado' });
    expect(transcript.text).toBe('Fígado sem alterações. Rins normais.');
  });

  it('reconcilia deltas recebidos antes da confirmação de commit', () => {
    const transcript = new RealtimeTranscript();
    transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'b', delta: 'Segundo.' });
    transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'Primeiro.' });
    transcript.update({ type: 'input_audio_buffer.committed', item_id: 'a', previous_item_id: null });
    transcript.update({ type: 'input_audio_buffer.committed', item_id: 'b', previous_item_id: 'a' });
    expect(transcript.text).toBe('Primeiro. Segundo.');
  });

  it('não altera texto com eventos de erro ou campos inválidos', () => {
    const transcript = new RealtimeTranscript();
    expect(transcript.update({ type: 'error' })).toBe(false);
    expect(transcript.update({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 1 })).toBe(false);
    expect(transcript.text).toBe('');
  });

  it('configura transcrição em português com PCM a 24 kHz e sem VAD de servidor', () => {
    const event = realtimeSessionUpdate();
    expect(event.session.type).toBe('transcription');
    expect(event.session.audio.input.format).toEqual({ type: 'audio/pcm', rate: 24000 });
    expect(event.session.audio.input.transcription).toMatchObject({ model: 'gpt-live-transcribe', languages: ['pt'] });
    expect(event.session.audio.input.turn_detection).toBeNull();
  });
});
