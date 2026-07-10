import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GeminiProvider } from './gemini-provider';
import { registerPlaceholderClip } from './placeholder-clips';
import type { TtsSynthesizer } from './tts';

// GT-504 media regression at the provider seam: generated assets serve from
// the manifest cache without regeneration; a missing clip synthesizes on
// demand into the cache (owner decision 2026-07-10); synthesis failure falls
// back to the placeholder and opens a cooldown so pages never stall.

const failingSynth: TtsSynthesizer = () => Promise.reject(new Error('quota exhausted'));

let dir: string;
let provider: GeminiProvider;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'gemini-media-'));
  mkdirSync(path.join(dir, 'images'), { recursive: true });
  mkdirSync(path.join(dir, 'audio'), { recursive: true });
  writeFileSync(path.join(dir, 'images', 'haus-flat.png'), 'png-bytes');
  writeFileSync(path.join(dir, 'audio', 'listen-a1-1.wav'), 'wav-bytes');
  writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      images: { 'das Haus:flat': 'images/haus-flat.png' },
      audio: { 'listen-a1-1': 'audio/listen-a1-1.wav' },
    }),
  );
  registerPlaceholderClip('listen-a1-1', 'Hallo! Guten Morgen.');
  provider = new GeminiProvider(undefined, dir, failingSynth);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GeminiProvider media serving (GT-504)', () => {
  it('serves generated images from the cache by the exact placeholder key', async () => {
    const asset = await provider.getImage('das Haus', 'flat');
    expect(asset.key).toBe('das Haus:flat');
    expect(asset.source).toEqual({ type: 'url', url: '/media/images/haus-flat.png' });
  });

  it('falls back to placeholder images for ungenerated keys', async () => {
    const asset = await provider.getImage('das Haus', 'render');
    expect(asset.source.type).toBe('inline-svg');
  });

  it('serves generated audio with captions retained but not mandatory', async () => {
    const asset = await provider.getAudio('listen-a1-1');
    expect(asset.source).toEqual({ type: 'url', url: '/media/audio/listen-a1-1.wav' });
    expect(asset.captionsRequired).toBe(false);
    expect(asset.captionText).toContain('Guten Morgen');
  });

  it('falls back to captioned placeholder audio when synthesis fails', async () => {
    registerPlaceholderClip('listen-a1-2', 'Das ist Jonas.');
    const asset = await provider.getAudio('listen-a1-2');
    expect(asset.source).toEqual({
      type: 'speech-synthesis',
      text: 'Das ist Jonas.',
      lang: 'de-DE',
    });
    expect(asset.captionsRequired).toBe(true);
  });
});

describe('on-demand audio synthesis and cache', () => {
  function freshDir(): string {
    const scratch = mkdtempSync(path.join(tmpdir(), 'gemini-ondemand-'));
    writeFileSync(path.join(scratch, 'manifest.json'), JSON.stringify({ images: {}, audio: {} }));
    return scratch;
  }

  it('synthesizes a missing clip once, caches it, and serves the file from then on', async () => {
    const scratch = freshDir();
    const synth = vi.fn().mockResolvedValue(Buffer.from('wav-bytes'));
    const onDemand = new GeminiProvider(undefined, scratch, synth);
    registerPlaceholderClip('word-hund-noun', 'der Hund');

    const first = await onDemand.getAudio('word-hund-noun');
    expect(first.source).toEqual({ type: 'url', url: '/media/audio/word-hund-noun.wav' });
    expect(first.captionsRequired).toBe(false);
    expect(existsSync(path.join(scratch, 'audio', 'word-hund-noun.wav'))).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(scratch, 'manifest.json'), 'utf8')) as {
      audio: Record<string, string>;
    };
    expect(manifest.audio['word-hund-noun']).toBe('audio/word-hund-noun.wav');

    const second = await onDemand.getAudio('word-hund-noun');
    expect(second.source.type).toBe('url');
    expect(synth).toHaveBeenCalledTimes(1);
    expect(synth).toHaveBeenCalledWith({
      text: 'der Hund',
      speakers: [{ name: 'Sprecher', voiceName: 'Kore' }],
      lang: 'de-DE',
    });
    rmSync(scratch, { recursive: true, force: true });
  });

  it('a synthesis failure opens the cooldown: no second attempt, placeholder served', async () => {
    const scratch = freshDir();
    const synth = vi.fn().mockRejectedValue(new Error('429 quota'));
    const onDemand = new GeminiProvider(undefined, scratch, synth);
    registerPlaceholderClip('word-brot-noun', 'das Brot');

    const first = await onDemand.getAudio('word-brot-noun');
    expect(first.source.type).toBe('speech-synthesis');
    const second = await onDemand.getAudio('word-brot-noun');
    expect(second.source.type).toBe('speech-synthesis');
    expect(synth).toHaveBeenCalledTimes(1);
    rmSync(scratch, { recursive: true, force: true });
  });

  it('a slow synthesis serves the placeholder now and the cached file afterwards', async () => {
    const scratch = freshDir();
    let finish: (wav: Buffer) => void = () => {};
    const synth = vi.fn().mockReturnValue(
      new Promise<Buffer>((resolve) => {
        finish = resolve;
      }),
    );
    // Wait budget of zero: generation always outlives the request.
    const onDemand = new GeminiProvider(undefined, scratch, synth, 0);
    registerPlaceholderClip('word-milch-noun', 'die Milch');

    const now = await onDemand.getAudio('word-milch-noun');
    expect(now.source.type).toBe('speech-synthesis');

    finish(Buffer.from('wav-bytes'));
    await vi.waitFor(() =>
      expect(existsSync(path.join(scratch, 'audio', 'word-milch-noun.wav'))).toBe(true),
    );
    const later = await onDemand.getAudio('word-milch-noun');
    expect(later.source).toEqual({ type: 'url', url: '/media/audio/word-milch-noun.wav' });
    expect(synth).toHaveBeenCalledTimes(1);
    rmSync(scratch, { recursive: true, force: true });
  });
});
