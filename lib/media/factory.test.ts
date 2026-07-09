import { describe, expect, it } from 'vitest';
import { createMediaProvider, MediaProviderError } from './index';
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

  it('GeminiProvider fails loudly and distinctly until Phase 5', () => {
    const provider = createMediaProvider('gemini');
    try {
      void provider.getImage('Tisch', 'flat');
      expect.unreachable('getImage must throw before GT-501');
    } catch (error) {
      expect(error).toBeInstanceOf(MediaProviderError);
      expect((error as MediaProviderError).reason).toBe('not-implemented');
      expect((error as MediaProviderError).message).toContain('GT-501');
    }
  });

  it('enforces the image asset key format at the type level', () => {
    const validKey: ImageAssetKey = 'Tisch:flat';
    expect(validKey).toBe('Tisch:flat');

    // @ts-expect-error keys without a valid style suffix fail typecheck
    const invalidKey: ImageAssetKey = 'Tisch:cartoon';
    expect(invalidKey).toBe('Tisch:cartoon');
  });
});
