'use server';

import { lookupCorpus } from '@/db/seed/seed-vocab';
import type { VocabularyWord } from '@/lib/db/curriculum';
import {
  fsrsCardStateConverter,
  fsrsCardStateSchema,
  learnerPaths,
  type FsrsCardState,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import {
  introduceCard,
  rateKnownCard,
  REVIEW_RATINGS,
  type ReviewRating,
} from '@/lib/fsrs/scheduler';

// Card persistence edge for the interactive warm-up: the pure GT-104/105
// scheduler decides everything; these actions only load, apply, and store.
// Card documents live at learners/default/cards/{wordId}.

async function loadCards(): Promise<Map<string, FsrsCardState>> {
  const raw = await getDataStore().list(learnerPaths.cards());
  const cards = new Map<string, FsrsCardState>();
  for (const data of raw) {
    const parsed = fsrsCardStateSchema.safeParse(data);
    if (parsed.success) cards.set(parsed.data.wordId, parsed.data);
  }
  return cards;
}

async function saveCard(card: FsrsCardState): Promise<void> {
  await getDataStore()
    .collection(learnerPaths.cards())
    .doc(card.wordId)
    .set(fsrsCardStateConverter.toFirestore(card));
}

// New words enter FSRS when their vocabulary step completes, due immediately,
// so the next warm-up reviews them. Existing cards are never reset.
export async function introduceWordsAction(wordIds: readonly string[]): Promise<number> {
  const cards = await loadCards();
  const now = new Date();
  let added = 0;
  for (const wordId of wordIds) {
    if (cards.has(wordId)) continue;
    await saveCard(introduceCard(wordId, now));
    added += 1;
  }
  return added;
}

export interface RateOutcome {
  readonly nextDue: string;
  readonly phase: FsrsCardState['phase'];
}

export async function rateCardAction(wordId: string, rating: ReviewRating): Promise<RateOutcome> {
  if (!REVIEW_RATINGS.includes(rating)) {
    throw new Error(`Unknown rating "${rating}".`);
  }
  const cards = await loadCards();
  const next = rateKnownCard(cards, wordId, rating, new Date());
  await saveCard(next);
  return { nextDue: next.due, phase: next.phase };
}

// The word lookup spans the full corpus: tapped words from reading texts can
// sit above the learner's level even though taught content stays A1.
export async function wordsForIds(
  wordIds: readonly string[],
): Promise<Record<string, VocabularyWord>> {
  const byId = new Map(lookupCorpus().map((word) => [word.id, word]));
  const found: Record<string, VocabularyWord> = {};
  for (const wordId of wordIds) {
    const word = byId.get(wordId);
    if (word) found[wordId] = word;
  }
  return found;
}
