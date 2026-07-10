import { vocabularyWordConverter, vocabularyWordSchema, type Level } from '@/lib/db/curriculum';
import { foundationVocabulary } from './foundation-vocab';
import type { SeedTarget } from './seed-curriculum';
import a1Words from './vocab/a1.json';
import a2Words from './vocab/a2.json';
import b1Words from './vocab/b1.json';

// Staged vocabulary seed (GT-103): A1 seeds on day one; A2 and B1 stay as
// files until explicitly invoked when the learner approaches those levels.
// Same idempotency contract as the curriculum seed: set() keyed by word id.
// Static JSON imports keep this working under the Next.js server bundle.

const SEED_FILES: Readonly<Record<Level, unknown[]>> = {
  A1: a1Words,
  A2: a2Words,
  B1: b1Words,
};

export function loadVocabSeedFile(level: Level): ReturnType<typeof vocabularyWordSchema.parse>[] {
  return SEED_FILES[level].map((entry) => vocabularyWordSchema.parse(entry));
}

// A learner at a level has the lower bands too; generation and selection
// against "learned vocabulary" should almost always use this.
export function cumulativeCorpus(level: Level): ReturnType<typeof loadVocabSeedFile> {
  const levels: Level[] =
    level === 'A1' ? ['A1'] : level === 'A2' ? ['A1', 'A2'] : ['A1', 'A2', 'B1'];
  return levels.flatMap((each) => loadVocabSeedFile(each));
}

// Display lookup across everything a card id can reference: the full corpus
// plus the foundation entries (numbers, pronouns). Use for warm-up display
// and word detail; NEVER for day-set selection or generation envelopes.
export function lookupCorpus(): ReturnType<typeof loadVocabSeedFile> {
  return [...cumulativeCorpus('B1'), ...foundationVocabulary];
}

export async function seedVocabulary(db: SeedTarget, level: Level): Promise<number> {
  const words = loadVocabSeedFile(level);
  const collection = db.collection('vocabulary');
  for (const word of words) {
    await collection.doc(word.id).set(vocabularyWordConverter.toFirestore(word));
  }
  return words.length;
}
