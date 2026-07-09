import type { VocabularyWord } from '@/lib/db/curriculum';

// Day-set selection (GT-103, PRD 3.3): thematic grouping within CEFR
// frequency order. The day's words share one theme, drawn from the highest-
// frequency words not yet learned. Pure function; the lesson engine (GT-108)
// supplies the corpus and the learned set.

export const DAY_SET_MIN = 10;
export const DAY_SET_MAX = 15;

export interface DaySet {
  readonly theme: string;
  readonly words: readonly VocabularyWord[];
}

export function selectDaySet(
  corpus: readonly VocabularyWord[],
  learnedWordIds: ReadonlySet<string>,
  size: number = DAY_SET_MAX,
): DaySet | null {
  const boundedSize = Math.max(DAY_SET_MIN, Math.min(DAY_SET_MAX, size));
  const unlearned = corpus
    .filter((word) => !learnedWordIds.has(word.id))
    .sort((a, b) => a.frequencyRank - b.frequencyRank || a.id.localeCompare(b.id));
  const anchor = unlearned[0];
  if (!anchor) return null;
  const words = unlearned.filter((word) => word.theme === anchor.theme).slice(0, boundedSize);
  return { theme: anchor.theme, words };
}
