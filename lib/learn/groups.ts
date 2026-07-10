import type { VocabularyWord } from '@/lib/db/curriculum';

// Word groups for the Learn browser (owner-directed 2026-07-10): the corpus
// themes become friendly real-life shelves; the huge "general" theme splits
// by word type, and any group over the chunk size splits further by
// frequency so no shelf is an unusable wall. Pure and deterministic.

export interface WordGroup {
  readonly id: string;
  readonly title: string;
  readonly words: readonly VocabularyWord[];
}

const THEME_TITLES: Readonly<Record<string, string>> = {
  'numbers-time': 'Numbers & time',
  'people-family': 'People & family',
  'health-body': 'Health & body',
  'greetings-social': 'Greetings & social life',
  'shopping-money': 'Shopping & money',
  'home-living': 'At home',
  'food-drink': 'Food & drink',
  'nature-weather': 'Nature & weather',
  'work-school': 'At work & school',
  'city-transport': 'In the city & on the move',
  'media-communication': 'Media & communication',
};

const GENERAL_TITLES: Readonly<Record<string, string>> = {
  noun: 'Core nouns',
  verb: 'Core verbs',
  adjective: 'Core adjectives',
  adverb: 'Core adverbs',
  other: 'Little words that matter',
  phrase: 'Everyday phrases',
};

// Above this size a group splits into frequency-ordered parts.
export const GROUP_CHUNK_SIZE = 100;

function byFrequency(a: VocabularyWord, b: VocabularyWord): number {
  return a.frequencyRank - b.frequencyRank || a.id.localeCompare(b.id);
}

function chunked(id: string, title: string, words: readonly VocabularyWord[]): WordGroup[] {
  const sorted = [...words].sort(byFrequency);
  if (sorted.length <= GROUP_CHUNK_SIZE) {
    return sorted.length > 0 ? [{ id, title, words: sorted }] : [];
  }
  const parts = Math.ceil(sorted.length / GROUP_CHUNK_SIZE);
  const size = Math.ceil(sorted.length / parts);
  return Array.from({ length: parts }, (_, index) => ({
    id: `${id}-${index + 1}`,
    title: `${title} ${index + 1}`,
    words: sorted.slice(index * size, (index + 1) * size),
  }));
}

export function buildWordGroups(corpus: readonly VocabularyWord[]): WordGroup[] {
  const groups: WordGroup[] = [];
  for (const [theme, title] of Object.entries(THEME_TITLES)) {
    groups.push(
      ...chunked(
        theme,
        title,
        corpus.filter((word) => word.theme === theme),
      ),
    );
  }
  const general = corpus.filter((word) => !(word.theme in THEME_TITLES));
  for (const [wordType, title] of Object.entries(GENERAL_TITLES)) {
    groups.push(
      ...chunked(
        `core-${wordType}`,
        title,
        general.filter((word) => word.wordType === wordType),
      ),
    );
  }
  return groups;
}

export function groupById(corpus: readonly VocabularyWord[], groupId: string): WordGroup | null {
  return buildWordGroups(corpus).find((group) => group.id === groupId) ?? null;
}
