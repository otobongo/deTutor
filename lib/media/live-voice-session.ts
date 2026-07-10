import { GoogleGenAI, Modality } from '@google/genai';
import { getConfig } from '@/lib/config';
import { TUTOR_SYSTEM_PROMPT } from '@/lib/prompts/tutor-system-prompt';
import type {
  VoiceConfig,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionListener,
} from './provider';
import { MediaProviderError } from './provider';
import { voiceForProfile } from './tts';

// Gemini Live voice session (GT-503). Emits the exact event contract the
// fallback session defined at GT-007, so scenario logic, corrections, and
// scoring run unchanged on real audio. The transport is injectable: the
// contract test drives a fake; production uses the Live API with de-DE,
// the profile voice, the canonical system prompt, VAD/barge-in, and
// transcription enabled.

export interface LiveConnection {
  sendText(text: string): void;
  close(): void;
}

export interface LiveHandlers {
  onTutorTranscript(text: string): void;
  onLearnerTranscript(text: string): void;
  onClose(): void;
}

export type LiveTransportFactory = (
  config: VoiceConfig,
  handlers: LiveHandlers,
) => Promise<LiveConnection>;

export const sdkLiveTransport: LiveTransportFactory = async (config, handlers) => {
  const appConfig = getConfig();
  const ai = new GoogleGenAI({ apiKey: appConfig.geminiApiKey });
  const session = await ai.live.connect({
    model: appConfig.models.live,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: config.scenarioContext
        ? `${TUTOR_SYSTEM_PROMPT}\n\n---\n\n## SCENARIO CONTEXT\n\n${config.scenarioContext}`
        : TUTOR_SYSTEM_PROMPT,
      speechConfig: {
        languageCode: 'de-DE',
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceForProfile(config.voice) },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Barge-in: automatic voice activity detection stays enabled so the
      // learner can interrupt the tutor mid-sentence.
      realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
    },
    callbacks: {
      onmessage: (message) => {
        const output = message.serverContent?.outputTranscription?.text;
        if (output) handlers.onTutorTranscript(output);
        const input = message.serverContent?.inputTranscription?.text;
        if (input) handlers.onLearnerTranscript(input);
      },
      onerror: () => handlers.onClose(),
      onclose: () => handlers.onClose(),
    },
  });
  return {
    sendText: (text: string) => {
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
    },
    close: () => session.close(),
  };
};

export class GeminiLiveVoiceSession implements VoiceSession {
  readonly mode = 'live-voice' as const;
  private readonly listeners = new Set<VoiceSessionListener>();
  private connection: LiveConnection | null = null;
  private ended = false;

  private constructor(readonly config: VoiceConfig) {}

  static async connect(
    config: VoiceConfig,
    factory: LiveTransportFactory,
  ): Promise<GeminiLiveVoiceSession> {
    const session = new GeminiLiveVoiceSession(config);
    session.connection = await factory(config, {
      onTutorTranscript: (text) => session.emit({ type: 'transcript', role: 'tutor', text }),
      onLearnerTranscript: (text) => {
        session.emit({ type: 'learnerInput', text });
        session.emit({ type: 'transcript', role: 'learner', text });
      },
      onClose: () => session.end(),
    });
    return session;
  }

  sendLearnerInput(text: string): void {
    this.assertActive('sendLearnerInput');
    this.connection?.sendText(text);
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
    this.connection?.close();
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
