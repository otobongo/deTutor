import { readFileSync } from 'node:fs';
import path from 'node:path';
import { vocabularyWordConverter, vocabularyWordSchema, type Level } from '@/lib/db/curriculum';
import type { SeedTarget } from './seed-curriculum';

// Staged vocabulary seed (GT-103): A1 seeds on day one; A2 and B1 stay as
// files until explicitly invoked when the learner approaches those levels.
// Same idempotency contract as the curriculum seed: set() keyed by word id.

export function loadVocabSeedFile(level: Level): ReturnType<typeof vocabularyWordSchema.parse>[] {
  const file = path.resolve(__dirname, 'vocab', `${level.toLowerCase()}.json`);
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown[];
  return raw.map((entry) => vocabularyWordSchema.parse(entry));
}

export async function seedVocabulary(db: SeedTarget, level: Level): Promise<number> {
  const words = loadVocabSeedFile(level);
  const collection = db.collection('vocabulary');
  for (const word of words) {
    await collection.doc(word.id).set(vocabularyWordConverter.toFirestore(word));
  }
  return words.length;
}
