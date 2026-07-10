import { z } from 'zod';
import type { Level, VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';

// Reading text generator (GT-207). The brain writes the German; code owns the
// envelope: level-appropriate format, length cap, and vocabulary constrained
// to the learned corpus plus a bounded stretch budget. Content invariants
// over content assertions (strategy Section 8).

export const READING_FORMATS_BY_LEVEL = {
  A1: ['sign', 'note'],
  A2: ['email', 'short-article'],
  B1: ['blog-post', 'press-report', 'advertisements'],
} as const;

export type ReadingFormat = (typeof READING_FORMATS_BY_LEVEL)[Level][number];

export const LENGTH_CAP_WORDS: Readonly<Record<Level, number>> = {
  A1: 45,
  A2: 130,
  B1: 280,
};

// Share of tokens allowed to fall outside the learned corpus. Generous
// enough to absorb inflection (corpus stores lemmas), tight enough to keep
// texts readable at level.
export const STRETCH_BUDGET = 0.35;

const readingTextSchema = z.object({
  format: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});
export type GeneratedReadingText = z.infer<typeof readingTextSchema> & {
  readonly level: Level;
};

export function tokenizeGerman(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export interface EnvelopeViolation {
  readonly rule: 'format' | 'length' | 'stretch-budget';
  readonly detail: string;
}

// Pronouns, articles, and auxiliary conjugations are grammar-item territory
// (the Goethe Wortliste deliberately excludes them), so they are always
// allowed regardless of the vocabulary corpus.
const ALWAYS_ALLOWED_FORMS = new Set([
  'ich',
  'du',
  'er',
  'sie',
  'es',
  'wir',
  'ihr',
  'mich',
  'dich',
  'ihn',
  'uns',
  'euch',
  'mir',
  'dir',
  'ihm',
  'ihnen',
  'mein',
  'meine',
  'meinen',
  'meinem',
  'meiner',
  'dein',
  'deine',
  'deinen',
  'sein',
  'seine',
  'seinen',
  'unser',
  'unsere',
  'euer',
  'eure',
  'ihre',
  'ihren',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'eines',
  'kein',
  'keine',
  'keinen',
  'keinem',
  'keiner',
  'bin',
  'bist',
  'ist',
  'sind',
  'seid',
  'war',
  'warst',
  'waren',
  'wart',
  'habe',
  'hast',
  'hat',
  'haben',
  'habt',
  'hatte',
  'hatten',
  'werde',
  'wirst',
  'wird',
  'werden',
  'werdet',
  'wurde',
  'wurden',
  'morgen',
  'dieser',
  'diese',
  'dieses',
  'diesen',
  'diesem',
]);

// Inflection-tolerant corpus membership: a token counts as in-corpus when it
// matches a lemma exactly or extends one by a short inflection ending.
function inCorpus(token: string, lemmas: ReadonlySet<string>, stems: readonly string[]): boolean {
  if (ALWAYS_ALLOWED_FORMS.has(token)) return true;
  if (lemmas.has(token)) return true;
  return stems.some(
    (stem) => token.startsWith(stem) && token.length - stem.length <= 3 && stem.length >= 3,
  );
}

// Shared with the dialogue envelope: the fraction of tokens falling outside
// the learned corpus (inflection-tolerant). Verb conjugations count as
// in-corpus via the infinitive stem: kommt matches kommen, kaufe matches
// kaufen, möchtest matches möchten.
export function outOfCorpusRate(text: string, corpus: readonly VocabularyWord[]): number {
  const tokens = tokenizeGerman(text);
  if (tokens.length === 0) return 0;
  const lemmas = new Set(corpus.map((word) => word.german.toLowerCase()));
  const stems = [...lemmas].flatMap((lemma) => {
    const variants = [lemma];
    if (lemma.endsWith('en')) variants.push(lemma.slice(0, -2));
    else if (lemma.endsWith('n')) variants.push(lemma.slice(0, -1));
    return variants;
  });
  return tokens.filter((token) => !inCorpus(token, lemmas, stems)).length / tokens.length;
}

export function validateReadingEnvelope(
  candidate: { format: string; text: string },
  level: Level,
  corpus: readonly VocabularyWord[],
): EnvelopeViolation[] {
  const violations: EnvelopeViolation[] = [];
  const allowedFormats: readonly string[] = READING_FORMATS_BY_LEVEL[level];
  if (!allowedFormats.includes(candidate.format)) {
    violations.push({
      rule: 'format',
      detail: `format "${candidate.format}" not allowed at ${level} (${allowedFormats.join(', ')})`,
    });
  }
  const tokens = tokenizeGerman(candidate.text);
  if (tokens.length > LENGTH_CAP_WORDS[level]) {
    violations.push({
      rule: 'length',
      detail: `${tokens.length} words exceeds the ${LENGTH_CAP_WORDS[level]}-word ${level} cap`,
    });
  }
  const rate = outOfCorpusRate(candidate.text, corpus);
  if (rate > STRETCH_BUDGET) {
    violations.push({
      rule: 'stretch-budget',
      detail: `${Math.round(rate * 100)}% of tokens outside corpus (budget ${STRETCH_BUDGET * 100}%)`,
    });
  }
  return violations;
}

export interface ReadingGenerationInput {
  readonly level: Level;
  readonly theme: string;
  readonly corpus: readonly VocabularyWord[];
}

export async function generateReadingText(
  client: GeminiClient,
  input: ReadingGenerationInput,
): Promise<GeneratedReadingText> {
  const formats = READING_FORMATS_BY_LEVEL[input.level].join(' | ');
  const sampleVocab = input.corpus
    .slice(0, 120)
    .map((word) => word.german)
    .join(', ');
  const prompt =
    `Generate a ${input.level} German reading text on the theme "${input.theme}".\n` +
    `Allowed formats: ${formats}. Maximum ${LENGTH_CAP_WORDS[input.level]} words.\n` +
    `Use ONLY vocabulary the learner knows (sample: ${sampleVocab}) plus at most a small stretch.\n` +
    'Return JSON: {"format":string,"title":string,"text":string}.';

  let lastViolations: EnvelopeViolation[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidate = await client.generateJson(
      [{ role: 'learner', text: prompt }],
      readingTextSchema,
      { callSite: 'reading-generation' },
    );
    lastViolations = validateReadingEnvelope(candidate, input.level, input.corpus);
    if (lastViolations.length === 0) {
      return { ...candidate, level: input.level };
    }
  }
  throw new GeminiError(
    'parse-failure',
    `Generated reading text violated the level envelope twice: ${lastViolations
      .map((violation) => violation.detail)
      .join('; ')}`,
  );
}
