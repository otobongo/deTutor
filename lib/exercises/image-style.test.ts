import { describe, expect, it } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { imageAssetKey } from '@/lib/db/curriculum';
import { buildPlaceholderImageAsset } from '@/lib/media/placeholder-images';
import { resolveImageStyle } from './image-style';

const concrete: VocabularyWord = {
  id: 'tisch-noun',
  german: 'Tisch',
  wordType: 'noun',
  article: 'der',
  translation: 'table',
  ipa: null,
  exampleDe: null,
  exampleEn: null,
  cefrLevel: 'A1',
  theme: 'home-living',
  picturable: true,
  frequencyRank: 100,
};

const category: VocabularyWord = {
  ...concrete,
  id: 'verkehr-noun',
  german: 'Verkehr',
  translation: 'traffic (in general)',
  theme: 'general',
  picturable: false,
};

describe('image style resolution (GT-204)', () => {
  it('follows the explicit preference for flat and render', () => {
    expect(resolveImageStyle('flat', concrete)).toBe('flat');
    expect(resolveImageStyle('render', category)).toBe('render');
  });

  it('Mixed picks render for concrete objects and flat for categories', () => {
    expect(resolveImageStyle('mixed', concrete)).toBe('render');
    expect(resolveImageStyle('mixed', category)).toBe('flat');
  });

  it('a style change flips the cached asset key without regeneration', () => {
    const flatKey = imageAssetKey('der Tisch', resolveImageStyle('flat', concrete));
    const mixedKey = imageAssetKey('der Tisch', resolveImageStyle('mixed', concrete));
    expect(flatKey).toBe('der Tisch:flat');
    expect(mixedKey).toBe('der Tisch:render');
    // Deterministic placeholder assets: the same key always yields the same
    // asset, so switching back costs nothing.
    expect(buildPlaceholderImageAsset('der Tisch', 'flat')).toEqual(
      buildPlaceholderImageAsset('der Tisch', 'flat'),
    );
  });
});
