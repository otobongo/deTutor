import type { VocabularyWord } from '@/lib/db/curriculum';
import { buildWordGroups, type WordGroup } from '@/lib/learn/groups';
import { foundationNumbers, foundationPronouns } from './foundation-vocab';

// The full Learn shelf for a level: the foundation word sets (numbers,
// pronouns) lead, then the theme groups from the corpus. One composition
// used by the overview and the flow pages so ids always resolve the same.

export function allLearnGroups(corpus: readonly VocabularyWord[]): WordGroup[] {
  return [
    { id: 'foundation-numbers', title: 'Numbers', words: foundationNumbers },
    { id: 'foundation-pronouns', title: 'Pronouns', words: foundationPronouns },
    ...buildWordGroups(corpus),
  ];
}

export function learnGroupById(
  corpus: readonly VocabularyWord[],
  groupId: string,
): WordGroup | null {
  return allLearnGroups(corpus).find((group) => group.id === groupId) ?? null;
}
