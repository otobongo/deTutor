import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { buildPlaceholderImageAsset } from './placeholder-images';
import { lookupPlaceholderClip } from './placeholder-clips';
import {
  GeminiLiveVoiceSession,
  sdkLiveTransport,
  type LiveTransportFactory,
} from './live-voice-session';

// The post-build provider (GT-501/502/503). Images and audio serve from the
// generation manifest under public/media; anything not yet generated falls
// back to the placeholder implementation so a partially generated corpus
// never breaks a flow (generation is per-level batched by design, PRD 7.6).

interface MediaManifest {
  images: Record<string, string>;
  audio: Record<string, string>;
}

export class GeminiProvider implements MediaProvider {
  constructor(
    private readonly liveTransportFactory: LiveTransportFactory = sdkLiveTransport,
    private readonly mediaDir: string = path.join(process.cwd(), 'public', 'media'),
  ) {}

  private readManifest(): MediaManifest {
    const file = path.join(this.mediaDir, 'manifest.json');
    if (!existsSync(file)) return { images: {}, audio: {} };
    return JSON.parse(readFileSync(file, 'utf8')) as MediaManifest;
  }

  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    const key = `${word}:${style}` as ImageAsset['key'];
    const file = this.readManifest().images[key];
    if (file) {
      return Promise.resolve({
        key,
        word,
        style,
        source: { type: 'url', url: `/media/${file}` },
      });
    }
    return Promise.resolve(buildPlaceholderImageAsset(word, style));
  }

  getAudio(clipId: string): Promise<AudioAsset> {
    const file = this.readManifest().audio[clipId];
    const captionText = lookupPlaceholderClip(clipId) ?? '';
    if (file) {
      return Promise.resolve({
        clipId,
        source: { type: 'url', url: `/media/${file}` },
        // Real audio is audible; captions stay available (accessibility data
        // retained per GT-502) but are no longer mandatory.
        captionsRequired: false,
        captionText: captionText || `[Audio clip ${clipId}]`,
      });
    }
    return Promise.resolve({
      clipId,
      source:
        captionText.length > 0
          ? { type: 'speech-synthesis', text: captionText, lang: 'de-DE' }
          : { type: 'silent' },
      captionsRequired: true,
      captionText: captionText || `[No placeholder text registered for clip "${clipId}"]`,
    });
  }

  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession> {
    return GeminiLiveVoiceSession.connect(config, this.liveTransportFactory);
  }
}
