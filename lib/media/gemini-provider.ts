import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { MediaProviderError } from './provider';

// Post-build implementation. Real media generation and Gemini Live sessions
// land in Phase 5: images (GT-501), audio (GT-502), voice (GT-503). Until
// then selecting the gemini provider fails loudly and distinctly.

export class GeminiProvider implements MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    throw new MediaProviderError(
      'not-implemented',
      `GeminiProvider.getImage(${word}, ${style}) lands at GT-501.`,
    );
  }

  getAudio(clipId: string): Promise<AudioAsset> {
    throw new MediaProviderError(
      'not-implemented',
      `GeminiProvider.getAudio(${clipId}) lands at GT-502.`,
    );
  }

  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession> {
    throw new MediaProviderError(
      'not-implemented',
      `GeminiProvider.getLiveVoiceSession(voice=${config.voice}) lands at GT-503.`,
    );
  }
}
