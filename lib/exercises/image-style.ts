import type { ImageStyle, VocabularyWord } from '@/lib/db/curriculum';
import type { ImageStylePreference } from '@/lib/db/learner';

// Image style resolution (GT-204, PRD 4.3). Mixed rule: render (pseudo-3D)
// for concrete objects, flat for category-like words. Style is part of the
// asset key, so a preference change flips which cached asset is requested;
// nothing regenerates.

const CONCRETE_THEMES = new Set([
  'home-living',
  'food-drink',
  'clothing',
  'city-transport',
  'nature-weather',
]);

export function resolveImageStyle(
  preference: ImageStylePreference,
  word: VocabularyWord,
): ImageStyle {
  if (preference === 'flat') return 'flat';
  if (preference === 'render') return 'render';
  return word.wordType === 'noun' && CONCRETE_THEMES.has(word.theme) ? 'render' : 'flat';
}
