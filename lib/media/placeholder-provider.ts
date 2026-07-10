import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { FallbackVoiceSession } from './fallback-voice-session';
import { buildPlaceholderImageAsset } from './placeholder-images';
import { lookupPlaceholderClipEntry } from './placeholder-clips';

// Permanent development implementation (Prime Directive 6): placeholders are
// production code, used forever in placeholder mode.

export class PlaceholderProvider implements MediaProvider {
  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    return Promise.resolve(buildPlaceholderImageAsset(word, style));
  }

  // Never throws: a known clip speaks via browser SpeechSynthesis in the
  // clip's language; an unknown clip degrades to a silent asset. Placeholder
  // audio always carries captionsRequired because audible playback cannot be
  // guaranteed (no matching voice installed, no SpeechSynthesis at all).
  getAudio(clipId: string): Promise<AudioAsset> {
    const entry = lookupPlaceholderClipEntry(clipId);
    if (entry === undefined) {
      return Promise.resolve({
        clipId,
        source: { type: 'silent' },
        captionsRequired: true,
        captionText: `[No placeholder text registered for clip "${clipId}"]`,
      });
    }
    return Promise.resolve({
      clipId,
      source: { type: 'speech-synthesis', text: entry.text, lang: entry.lang },
      captionsRequired: true,
      captionText: entry.text,
    });
  }

  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession> {
    return Promise.resolve(new FallbackVoiceSession(config));
  }
}
