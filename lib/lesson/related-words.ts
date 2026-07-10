import type { VocabularyWord } from '@/lib/db/curriculum';

// Word neighborhood (owner-directed 2026-07-10): the word workspace shows a
// focus word inside its context, the way Google Translate surrounds a
// translation with alternatives. Pure and deterministic over the corpus:
// family members share a stem (compounds and derivations), theme neighbors
// share the theme at the nearest frequency. No RNG, no brain.

export interface RelatedWord {
  readonly word: VocabularyWord;
  readonly relation: 'family' | 'theme';
}

const MIN_STEM_LENGTH = 4;

function sharesFamily(a: string, b: string): boolean {
  const first = a.toLowerCase();
  const second = b.toLowerCase();
  if (first === second) return false;
  return (
    (first.length >= MIN_STEM_LENGTH && second.includes(first)) ||
    (second.length >= MIN_STEM_LENGTH && first.includes(second))
  );
}

export function relatedWordsFor(
  target: VocabularyWord,
  corpus: readonly VocabularyWord[],
  max = 5,
): RelatedWord[] {
  const family = corpus
    .filter((word) => word.id !== target.id && sharesFamily(target.german, word.german))
    .sort(
      (a, b) =>
        Math.abs(a.frequencyRank - target.frequencyRank) -
          Math.abs(b.frequencyRank - target.frequencyRank) || a.id.localeCompare(b.id),
    )
    .map((word): RelatedWord => ({ word, relation: 'family' }));

  const familyIds = new Set(family.map((entry) => entry.word.id));
  const theme = corpus
    .filter(
      (word) => word.id !== target.id && !familyIds.has(word.id) && word.theme === target.theme,
    )
    .sort(
      (a, b) =>
        Math.abs(a.frequencyRank - target.frequencyRank) -
          Math.abs(b.frequencyRank - target.frequencyRank) || a.id.localeCompare(b.id),
    )
    .map((word): RelatedWord => ({ word, relation: 'theme' }));

  return [...family, ...theme].slice(0, max);
}
