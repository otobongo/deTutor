import type { VocabularyWord } from '@/lib/db/curriculum';

// Disguised retest presentation (GT-304): a retest must be visually
// indistinguishable from a normal review card, so each due retest borrows a
// deterministic word from the learner's corpus as its face. The learner
// rates recall like any card; the result silently moves the unit's
// retention score, never the word's FSRS state.

export function disguiseWordFor(
  retestId: string,
  corpus: readonly VocabularyWord[],
): VocabularyWord | null {
  if (corpus.length === 0) return null;
  let hash = 0x811c9dc5;
  for (const char of retestId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return corpus[hash % corpus.length] ?? null;
}
