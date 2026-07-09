import { z } from 'zod';
import { articleSchema, wordTypeSchema, type VocabularyWord } from '@/lib/db/curriculum';
import type { FsrsCardState } from '@/lib/db/learner';
import { introduceCard } from '@/lib/fsrs/scheduler';
import type { GeminiClient } from '@/lib/gemini/client';
import { slugify } from '@/scripts/ingest/core';

// Tap-to-queue (GT-209): tapping any word in a reading text shows its card
// (from the corpus) or a generated mini-card, and enqueues it as a new FSRS
// card. Duplicate taps never create a second card.

export function lookupTappedWord(
  token: string,
  corpus: readonly VocabularyWord[],
): VocabularyWord | null {
  const normalized = token.replace(/[^\p{L}-]/gu, '').toLowerCase();
  if (normalized.length === 0) return null;
  return (
    corpus.find((word) => word.german.toLowerCase() === normalized) ??
    // Inflection tolerance: the tapped form may extend a lemma slightly.
    corpus.find(
      (word) =>
        word.german.length >= 3 &&
        normalized.startsWith(word.german.toLowerCase()) &&
        normalized.length - word.german.length <= 3,
    ) ??
    null
  );
}

export interface EnqueueResult {
  readonly cards: ReadonlyMap<string, FsrsCardState>;
  readonly added: boolean;
}

export function enqueueTappedWord(
  cards: ReadonlyMap<string, FsrsCardState>,
  wordId: string,
  now: Date,
): EnqueueResult {
  if (cards.has(wordId)) {
    return { cards, added: false };
  }
  const next = new Map(cards);
  next.set(wordId, introduceCard(wordId, now));
  return { cards: next, added: true };
}

// Mini-card for out-of-corpus taps: the brain supplies the essentials, the
// schema keeps them honest (nouns must carry an article).
export const miniCardSchema = z
  .object({
    german: z.string().min(1),
    wordType: wordTypeSchema,
    article: articleSchema.nullable(),
    translation: z.string().min(1),
  })
  .refine((card) => card.wordType !== 'noun' || card.article !== null, {
    message: 'A noun mini-card must carry its article.',
  });
export type MiniCard = z.infer<typeof miniCardSchema> & { readonly id: string };

export async function generateMiniCard(client: GeminiClient, token: string): Promise<MiniCard> {
  const card = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          `The learner tapped the unknown German word "${token}" in a reading text.\n` +
          'Return JSON: {"german":string (lemma),"wordType":"noun"|"verb"|"adjective"|"adverb"|"phrase"|"other",' +
          '"article":"der"|"die"|"das"|null,"translation":string}. Nouns must include their article.',
      },
    ],
    miniCardSchema,
    { callSite: 'reading-generation' },
  );
  return { ...card, id: `${slugify(card.german)}-${card.wordType}` };
}
