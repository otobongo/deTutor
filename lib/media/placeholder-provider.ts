import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { MediaProviderError } from './provider';

// Permanent development implementation (Prime Directive 6): placeholders are
// production code, used forever in placeholder mode. Methods land with their
// issues: getImage (GT-006), getAudio and getLiveVoiceSession (GT-007).

export class PlaceholderProvider implements MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    throw new MediaProviderError(
      'not-implemented',
      `getImage(${word}, ${style}) is implemented by GT-006.`,
    );
  }

  getAudio(clipId: string): Promise<AudioAsset> {
    throw new MediaProviderError(
      'not-implemented',
      `getAudio(${clipId}) is implemented by GT-007.`,
    );
  }

  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession> {
    throw new MediaProviderError(
      'not-implemented',
      `getLiveVoiceSession(voice=${config.voice}) is implemented by GT-007.`,
    );
  }
}
