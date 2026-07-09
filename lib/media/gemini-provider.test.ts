import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GeminiProvider } from './gemini-provider';
import { registerPlaceholderClip } from './placeholder-clips';

// GT-504 media regression at the provider seam: generated assets serve from
// the manifest cache without regeneration; anything missing falls back to
// the placeholder implementation, so a partial corpus never breaks a flow.

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
  provider = new GeminiProvider(undefined, dir);
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

  it('falls back to captioned placeholder audio for ungenerated clips', async () => {
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
