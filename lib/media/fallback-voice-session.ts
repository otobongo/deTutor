import type {
  VoiceConfig,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionListener,
} from './provider';
import { MediaProviderError } from './provider';

// Text-mode voice session (GT-007). Exposes the exact event shape the Gemini
// Live session (GT-503) will emit, so scenario logic, corrections, and
// scoring are built once and never change when real voice arrives. Speech
// recognition, where the browser offers it, feeds sendLearnerInput with a
// transcript; typed input uses the same door.

export class FallbackVoiceSession implements VoiceSession {
  readonly mode = 'fallback-text' as const;
  private readonly listeners = new Set<VoiceSessionListener>();
  private ended = false;

  constructor(readonly config: VoiceConfig) {}

  sendLearnerInput(text: string): void {
    this.assertActive('sendLearnerInput');
    this.emit({ type: 'learnerInput', text });
    this.emit({ type: 'transcript', role: 'learner', text });
  }

  sendTutorTurn(text: string): void {
    this.assertActive('sendTutorTurn');
    this.emit({ type: 'transcript', role: 'tutor', text });
  }

  on(listener: VoiceSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.emit({ type: 'end' });
    this.listeners.clear();
  }

  private assertActive(method: string): void {
    if (this.ended) {
      throw new MediaProviderError('generation-failed', `${method} called after end().`);
    }
  }

  private emit(event: VoiceSessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
