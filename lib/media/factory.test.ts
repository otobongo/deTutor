import { describe, expect, it } from 'vitest';
import { createMediaProvider } from './index';
import { GeminiProvider } from './gemini-provider';
import { PlaceholderProvider } from './placeholder-provider';
import type { ImageAssetKey } from './provider';

describe('media provider factory (GT-005)', () => {
  it('returns the PlaceholderProvider when the flag is placeholder', () => {
    expect(createMediaProvider('placeholder')).toBeInstanceOf(PlaceholderProvider);
  });

  it('returns the GeminiProvider when the flag is gemini', () => {
    expect(createMediaProvider('gemini')).toBeInstanceOf(GeminiProvider);
  });

  it('GeminiProvider serves assets since Phase 5 (placeholder fallback when ungenerated)', async () => {
    const provider = createMediaProvider('gemini');
    const asset = await provider.getImage('der Tisch', 'flat');
    expect(asset.key).toBe('der Tisch:flat');
    expect(['url', 'inline-svg']).toContain(asset.source.type);
  });

  it('enforces the image asset key format at the type level', () => {
    const validKey: ImageAssetKey = 'Tisch:flat';
    expect(validKey).toBe('Tisch:flat');

    // @ts-expect-error keys without a valid style suffix fail typecheck
    const invalidKey: ImageAssetKey = 'Tisch:cartoon';
    expect(invalidKey).toBe('Tisch:cartoon');
  });
});
