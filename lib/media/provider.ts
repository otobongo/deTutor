import type { ImageStyle } from '@/lib/db/curriculum';
import type { Dialect } from '@/lib/db/learner';

// The MediaProvider contract (GT-005), the single most protected seam in the
// build. The interface below matches PRD 7.4 verbatim. Placeholder and Gemini
// implementations are interchangeable behind it; app code imports only from
// @/lib/media (enforced by the CI guard).

export interface MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset>;
  getAudio(clipId: string): Promise<AudioAsset>;
  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession>;
}

// Asset keys are enforced by type: images are `{word}:{style}`, audio is a
// bare `{clipId}`. The same keys address placeholder and generated assets, so
// the GT-504 provider flip needs no data migration.
export type ImageAssetKey = `${string}:${ImageStyle}`;

export interface ImageAsset {
  readonly key: ImageAssetKey;
  readonly word: string;
  readonly style: ImageStyle;
  readonly source: ImageSource;
}

export type ImageSource =
  | { readonly type: 'inline-svg'; readonly svg: string }
  | { readonly type: 'url'; readonly url: string };

export interface AudioAsset {
  readonly clipId: string;
  readonly source: AudioSource;
  // When true, the UI must always render captions for this asset (GT-007).
  readonly captionsRequired: boolean;
  readonly captionText: string;
}

export type AudioSource =
  | {
      readonly type: 'speech-synthesis';
      readonly text: string;
      // German content clips speak de-DE; explanation clips speak en-US.
      readonly lang: 'de-DE' | 'en-US';
    }
  | { readonly type: 'url'; readonly url: string }
  | { readonly type: 'silent' };

export interface VoiceConfig {
  readonly voice: string;
  readonly dialect: Dialect;
  // Scenario/context layer injected per session; never a forked system prompt.
  readonly scenarioContext: string | null;
}

// The event-shape contract shared by the fallback session (GT-007) and the
// Gemini Live session (GT-503). The GT-503 contract test runs against both.
export type VoiceSessionEvent =
  | { readonly type: 'transcript'; readonly role: 'tutor' | 'learner'; readonly text: string }
  | { readonly type: 'learnerInput'; readonly text: string }
  | { readonly type: 'end' };

export type VoiceSessionEventType = VoiceSessionEvent['type'];

export type VoiceSessionListener = (event: VoiceSessionEvent) => void;

export interface VoiceSession {
  readonly mode: 'fallback-text' | 'live-voice';
  readonly config: VoiceConfig;
  // Learner input enters here (typed text or recognized speech transcript).
  sendLearnerInput(text: string): void;
  // Tutor output enters here (scenario runtime pushes brain turns into the session).
  sendTutorTurn(text: string): void;
  on(listener: VoiceSessionListener): () => void;
  end(): void;
}

export class MediaProviderError extends Error {
  constructor(
    readonly reason: 'not-implemented' | 'invalid-key' | 'generation-failed',
    message: string,
  ) {
    super(message);
    this.name = 'MediaProviderError';
  }
}
