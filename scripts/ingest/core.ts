import {
  ARTICLES,
  vocabularyWordSchema,
  type Article,
  type Level,
  type VocabularyWord,
  type WordType,
} from '@/lib/db/curriculum';
import type { CuratedEntry } from '@/db/seed/curated-translations';

// Vocabulary ingestion core (GT-102), pure functions only; the runner script
// owns all file I/O. Corpus strategy (deviation logged in board.md): the
// Goethe B1 Wortliste is the authoritative corpus and B1 ceiling; vocabforge
// supplies translations and articles; german-nouns verifies every article;
// OpenSubtitles frequency drives level banding (A1 = most frequent band).

export interface WortlisteEntry {
  readonly raw: string;
  readonly lemma: string;
  readonly article: Article | null;
  // Marked "(Pl.)" in the Wortliste: plurale tantum, always die by rule.
  readonly pluralOnly: boolean;
}

export interface VocabforgeRow {
  readonly lemma: string;
  readonly category: string;
  readonly translation: string;
  readonly article: string;
}

export interface ArticleReviewEntry {
  readonly lemma: string;
  readonly claimed: string;
  readonly allowed: readonly string[];
  readonly reason: 'mismatch' | 'unverified';
}

export interface TranslationPendingEntry {
  readonly lemma: string;
  readonly frequencyRank: number;
}

export interface IngestInputs {
  readonly wortlisteLines: readonly string[];
  readonly vocabforgeRows: readonly VocabforgeRow[];
  readonly genusByLemma: ReadonlyMap<string, ReadonlySet<Article>>;
  readonly frequencyRanks: ReadonlyMap<string, number>;
  readonly curated: Readonly<Record<string, CuratedEntry>>;
  readonly themeOverrides: Readonly<Record<string, string>>;
  readonly picturableOverrides: Readonly<Record<string, boolean>>;
  readonly levelBands?: { readonly a1: number; readonly a2: number };
}

export interface IngestOutputs {
  readonly words: readonly VocabularyWord[];
  readonly articleReview: readonly ArticleReviewEntry[];
  readonly translationPending: readonly TranslationPendingEntry[];
}

const WORD_TYPE_BY_CATEGORY: Readonly<Record<string, WordType>> = {
  nouns: 'noun',
  verbs: 'verb',
  adjectives: 'adjective',
  adverbs: 'adverb',
  phrases: 'phrase',
  prepositions: 'other',
};

const THEME_KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['greetings-social', ['hello', 'greet', 'thank', 'please', 'welcome', 'goodbye', 'sorry']],
  [
    'people-family',
    [
      'mother',
      'father',
      'child',
      'family',
      'friend',
      'brother',
      'sister',
      'aunt',
      'uncle',
      'nephew',
      'niece',
      'people',
      'person',
      'married',
      'woman',
      'man',
    ],
  ],
  [
    'home-living',
    [
      'house',
      'apartment',
      'room',
      'kitchen',
      'table',
      'chair',
      'bed',
      'door',
      'window',
      'blanket',
      'lamp',
      'shower',
      'rent',
      'furniture',
      'ceiling',
      'plate',
      'laundry',
    ],
  ],
  [
    'food-drink',
    [
      'eat',
      'drink',
      'food',
      'bread',
      'water',
      'coffee',
      'tea',
      'milk',
      'butter',
      'cake',
      'meal',
      'breakfast',
      'lunch',
      'dinner',
      'fruit',
      'vegetable',
      'sweet',
      'hungry',
      'full (after eating)',
      'chicken',
      'cream',
    ],
  ],
  [
    'numbers-time',
    [
      'hour',
      'minute',
      'day',
      'week',
      'month',
      'year',
      'time',
      'clock',
      'today',
      'tomorrow',
      'yesterday',
      'morning',
      'evening',
      'calendar',
    ],
  ],
  [
    'city-transport',
    [
      'street',
      'city',
      'train',
      'bus',
      'car',
      'subway',
      'underground',
      'station',
      'ticket',
      'travel',
      'drive',
      'ferry',
      'traffic',
    ],
  ],
  [
    'shopping-money',
    [
      'buy',
      'shop',
      'money',
      'price',
      'pay',
      'cost',
      'euro',
      'card, map, ticket',
      'credit',
      'supermarket',
      'market',
    ],
  ],
  [
    'work-school',
    [
      'work',
      'job',
      'office',
      'school',
      'teacher',
      'student',
      'learn',
      'study',
      'career',
      'colleague',
      'boss',
      'employee',
    ],
  ],
  [
    'health-body',
    [
      'doctor',
      'sick',
      'ill',
      'health',
      'body',
      'head',
      'hand',
      'foot',
      'pain',
      'hospital',
      'medicine',
    ],
  ],
  [
    'nature-weather',
    [
      'weather',
      'rain',
      'sun',
      'snow',
      'wind',
      'tree',
      'flower',
      'plant',
      'animal',
      'dog',
      'cat',
      'cold',
      'warm',
      'hot',
      'wet',
    ],
  ],
  [
    'media-communication',
    [
      'television',
      'radio',
      'newspaper',
      'internet',
      'phone',
      'letter',
      'write',
      'read',
      'news',
      'media',
      'speech',
    ],
  ],
  [
    'clothing',
    ['wear', 'jacket', 'trousers', 'shirt', 'shoe', 'dress', 'clothes', 'pullover', 'jeans'],
  ],
];

export function themeFor(translation: string, override: string | undefined): string {
  if (override) return override;
  const haystack = translation.toLowerCase();
  for (const [theme, keywords] of THEME_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return theme;
  }
  return 'general';
}

const ABSTRACT_NOUN_SUFFIXES = ['ung', 'heit', 'keit', 'schaft', 'ion', 'tät', 'nis'];
const PICTURABLE_THEMES = new Set([
  'home-living',
  'food-drink',
  'city-transport',
  'nature-weather',
  'clothing',
]);

export function picturableFor(
  lemma: string,
  wordType: WordType,
  theme: string,
  override: boolean | undefined,
): boolean {
  if (override !== undefined) return override;
  if (wordType !== 'noun') return false;
  if (ABSTRACT_NOUN_SUFFIXES.some((suffix) => lemma.toLowerCase().endsWith(suffix))) return false;
  return PICTURABLE_THEMES.has(theme);
}

export function slugify(lemma: string): string {
  return lemma
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseWortlisteLine(line: string): WortlisteEntry | null {
  const raw = line.trim();
  if (raw.length === 0) return null;
  const pluralOnly = /\(Pl\.?\)/i.test(raw);
  let head = raw.split(',')[0] ?? '';
  head = head.split('/')[0] ?? '';
  head = head.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  head = head.replace(/!$/, '').trim();
  if (head.length === 0) return null;
  const articleMatch = /^(der|die|das)\s+(.+)$/.exec(head);
  if (articleMatch && ARTICLES.includes(articleMatch[1] as Article)) {
    return {
      raw,
      lemma: (articleMatch[2] ?? '').trim(),
      article: articleMatch[1] as Article,
      pluralOnly,
    };
  }
  return { raw, lemma: head, article: null, pluralOnly };
}

function matchKeys(lemma: string): string[] {
  const base = lemma.toLowerCase();
  const keys = new Set<string>([base, base.replace(/-+$/, ''), base.replace(/ß/g, 'ss')]);
  keys.add(base.replace(/-+$/, '').replace(/ß/g, 'ss'));
  return [...keys].filter((key) => key.length > 0);
}

function lookupFrequency(
  ranks: ReadonlyMap<string, number>,
  lemma: string,
  fallback: number,
): number {
  for (const key of matchKeys(lemma)) {
    const rank = ranks.get(key);
    if (rank !== undefined) return rank;
  }
  return fallback;
}

const DEFAULT_BANDS = { a1: 650, a2: 650 } as const;

export function ingest(inputs: IngestInputs): IngestOutputs {
  const bands = inputs.levelBands ?? DEFAULT_BANDS;
  const vocabforgeByKey = new Map<string, VocabforgeRow[]>();
  for (const row of inputs.vocabforgeRows) {
    const key = row.lemma.toLowerCase();
    const rows = vocabforgeByKey.get(key) ?? [];
    rows.push(row);
    vocabforgeByKey.set(key, rows);
  }

  const articleReview: ArticleReviewEntry[] = [];
  const translationPending: TranslationPendingEntry[] = [];
  const seen = new Set<string>();
  interface Candidate {
    lemma: string;
    article: Article | null;
    wordType: WordType;
    translation: string;
    frequencyRank: number;
  }
  const candidates: Candidate[] = [];
  let fallbackRank = 60000;

  for (const line of inputs.wortlisteLines) {
    const entry = parseWortlisteLine(line);
    if (!entry) continue;
    const dedupeKey = entry.lemma.toLowerCase().replace(/-+$/, '');
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    fallbackRank += 1;
    const frequencyRank = lookupFrequency(inputs.frequencyRanks, entry.lemma, fallbackRank);

    // Resolve translation and word type: curated first, then vocabforge.
    const curated =
      inputs.curated[entry.lemma] ??
      inputs.curated[entry.lemma.replace(/-+$/, '')] ??
      inputs.curated[entry.lemma.toLowerCase()];
    // German orthography: a lowercase lemma is never a noun. vocabforge
    // mistags common verbs as nouns (das Können), so pick the row whose
    // category agrees with the lemma's capitalization.
    const wantsNoun = entry.article !== null || /^[A-ZÄÖÜ]/.test(entry.lemma);
    let vocabforgeRow: VocabforgeRow | undefined;
    for (const key of matchKeys(entry.lemma)) {
      const rows = vocabforgeByKey.get(key);
      if (!rows || rows.length === 0) continue;
      vocabforgeRow = rows.find((row) => (row.category === 'nouns') === wantsNoun) ?? rows[0];
      break;
    }

    let translation: string | undefined;
    let wordType: WordType | undefined;
    if (curated) {
      translation = curated.translation;
      wordType = curated.wordType;
    } else if (vocabforgeRow) {
      translation = vocabforgeRow.translation;
      wordType = WORD_TYPE_BY_CATEGORY[vocabforgeRow.category] ?? 'other';
      if (!wantsNoun && wordType === 'noun') wordType = 'other';
    }
    if (entry.article !== null) wordType = 'noun';

    if (!translation || translation.trim().length === 0 || wordType === undefined) {
      translationPending.push({ lemma: entry.lemma, frequencyRank });
      continue;
    }

    // Article resolution and verification. Zero unverified noun articles
    // enter the corpus: absent from german-nouns means review, not write.
    let article: Article | null = entry.article;
    if (wordType === 'noun') {
      if (
        article === null &&
        vocabforgeRow &&
        ARTICLES.includes(vocabforgeRow.article as Article)
      ) {
        article = vocabforgeRow.article as Article;
      }
      if (article === null) {
        articleReview.push({ lemma: entry.lemma, claimed: '', allowed: [], reason: 'unverified' });
        continue;
      }
      const allowed = inputs.genusByLemma.get(entry.lemma);
      if (entry.pluralOnly && article === 'die') {
        // Plurals always take die (PRD 3.4 pattern rule); genus datasets have
        // no singular genus for plurale tantum, so the rule itself verifies.
      } else if (!allowed || allowed.size === 0) {
        articleReview.push({
          lemma: entry.lemma,
          claimed: article,
          allowed: [],
          reason: 'unverified',
        });
        continue;
      } else if (!allowed.has(article)) {
        articleReview.push({
          lemma: entry.lemma,
          claimed: article,
          allowed: [...allowed].sort(),
          reason: 'mismatch',
        });
        continue;
      }
    } else {
      article = null;
    }

    candidates.push({ lemma: entry.lemma, article, wordType, translation, frequencyRank });
  }

  candidates.sort(
    (a, b) => a.frequencyRank - b.frequencyRank || a.lemma.localeCompare(b.lemma, 'de'),
  );

  const words = candidates.map((candidate, index) => {
    const level: Level = index < bands.a1 ? 'A1' : index < bands.a1 + bands.a2 ? 'A2' : 'B1';
    const theme = themeFor(candidate.translation, inputs.themeOverrides[candidate.lemma]);
    return vocabularyWordSchema.parse({
      id: `${slugify(candidate.lemma)}-${candidate.wordType}`,
      german: candidate.lemma,
      wordType: candidate.wordType,
      article: candidate.article,
      translation: candidate.translation,
      ipa: null,
      exampleDe: null,
      exampleEn: null,
      cefrLevel: level,
      theme,
      picturable: picturableFor(
        candidate.lemma,
        candidate.wordType,
        theme,
        inputs.picturableOverrides[candidate.lemma],
      ),
      frequencyRank: candidate.frequencyRank,
    });
  });

  return { words, articleReview, translationPending };
}
