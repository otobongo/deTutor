import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AudioAsset, ImageAsset, MediaProvider, VoiceConfig, VoiceSession } from './provider';
import { buildPlaceholderImageAsset } from './placeholder-images';
import { lookupPlaceholderClipEntry } from './placeholder-clips';
import { MEDIA_DIR, readManifest, writeManifest } from './manifest';
import { DEFAULT_TTS_VOICE, sdkTtsSynthesizer, type TtsSynthesizer } from './tts';
import {
  GeminiLiveVoiceSession,
  sdkLiveTransport,
  type LiveTransportFactory,
} from './live-voice-session';

// The post-build provider (GT-501/502/503). Images serve from the generation
// manifest under public/media with placeholder fallback. Audio is on-demand
// (owner decision 2026-07-10): a missing clip is synthesized on first
// request, cached to disk plus the manifest, and served from cache forever
// after. This fits daily sessions inside small TTS quotas (10 to 20 new
// clips a day) instead of burning them in batch. A synthesis failure opens a
// cooldown window so a dead quota never slows pages, and the caller gets the
// captioned speech-synthesis placeholder, never an error.

// How long a single page load will wait for a fresh clip before serving the
// placeholder and letting synthesis finish in the background for next time.
export const ON_DEMAND_WAIT_MS = 4_000;
// After any synthesis failure, skip attempts for this long (quota windows
// are minutes to a day; retrying per-request would stall every page).
export const SYNTH_COOLDOWN_MS = 10 * 60 * 1000;

export class GeminiProvider implements MediaProvider {
  private readonly inFlight = new Map<string, Promise<boolean>>();
  private cooldownUntil = 0;

  constructor(
    private readonly liveTransportFactory: LiveTransportFactory = sdkLiveTransport,
    private readonly mediaDir: string = MEDIA_DIR,
    private readonly synthesize: TtsSynthesizer = sdkTtsSynthesizer,
    private readonly onDemandWaitMs: number = ON_DEMAND_WAIT_MS,
  ) {}

  getImage(word: string, style: 'flat' | 'render'): Promise<ImageAsset> {
    const key = `${word}:${style}` as ImageAsset['key'];
    const file = readManifest(this.mediaDir).images[key];
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

  async getAudio(clipId: string): Promise<AudioAsset> {
    const entry = lookupPlaceholderClipEntry(clipId);
    const captionText = entry?.text ?? '';
    const served = this.servedAsset(clipId, captionText);
    if (served) return served;

    if (entry && Date.now() >= this.cooldownUntil) {
      const generation = this.generateClip(clipId, entry.text, entry.lang);
      // Bounded wait: serve the fresh clip when synthesis is quick, or fall
      // back now and let the background generation land it for next time.
      const done = await Promise.race([
        generation,
        new Promise<false>((resolve) => setTimeout(() => resolve(false), this.onDemandWaitMs)),
      ]);
      if (done) {
        const fresh = this.servedAsset(clipId, captionText);
        if (fresh) return fresh;
      }
    }

    return {
      clipId,
      source: entry
        ? { type: 'speech-synthesis', text: entry.text, lang: entry.lang }
        : { type: 'silent' },
      captionsRequired: true,
      captionText: captionText || `[No placeholder text registered for clip "${clipId}"]`,
    };
  }

  private servedAsset(clipId: string, captionText: string): AudioAsset | null {
    const file = readManifest(this.mediaDir).audio[clipId];
    if (!file || !existsSync(path.join(this.mediaDir, file))) return null;
    return {
      clipId,
      source: { type: 'url', url: `/media/${file}` },
      // Real audio is audible; captions stay available (accessibility data
      // retained per GT-502) but are no longer mandatory.
      captionsRequired: false,
      captionText: captionText || `[Audio clip ${clipId}]`,
    };
  }

  // One synthesis per clip at a time; resolves true when the clip landed on
  // disk. Failures open the cooldown and resolve false, never throw.
  private generateClip(clipId: string, text: string, lang: 'de-DE' | 'en-US'): Promise<boolean> {
    const existing = this.inFlight.get(clipId);
    if (existing) return existing;
    const generation = (async (): Promise<boolean> => {
      try {
        const wav = await this.synthesize({
          text,
          speakers: [{ name: 'Sprecher', voiceName: DEFAULT_TTS_VOICE }],
          lang,
        });
        mkdirSync(path.join(this.mediaDir, 'audio'), { recursive: true });
        const fileName = `audio/${clipId}.wav`;
        writeFileSync(path.join(this.mediaDir, fileName), wav);
        const manifest = readManifest(this.mediaDir);
        manifest.audio[clipId] = fileName;
        writeManifest(manifest, this.mediaDir);
        return true;
      } catch {
        this.cooldownUntil = Date.now() + SYNTH_COOLDOWN_MS;
        return false;
      } finally {
        this.inFlight.delete(clipId);
      }
    })();
    this.inFlight.set(clipId, generation);
    return generation;
  }

  getLiveVoiceSession(config: VoiceConfig): Promise<VoiceSession> {
    return GeminiLiveVoiceSession.connect(config, this.liveTransportFactory);
  }
}
