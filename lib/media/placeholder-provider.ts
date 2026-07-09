import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { MediaProviderError } from './provider';
import { buildPlaceholderImageAsset } from './placeholder-images';

// Permanent development implementation (Prime Directive 6): placeholders are
// production code, used forever in placeholder mode. getAudio and
// getLiveVoiceSession land with GT-007.

export class PlaceholderProvider implements MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    return Promise.resolve(buildPlaceholderImageAsset(word, style));
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
