import { describe, expect, it } from 'vitest';
import { loadVocabSeedFile, seedVocabulary } from './seed-vocab';
import type { SeedTarget } from './seed-curriculum';
import { selectDaySet } from '@/lib/lesson/vocab-selection';

function fakeDb() {
  const written = new Map<string, FirebaseFirestore.DocumentData>();
  const db: SeedTarget = {
    collection: (path: string) => ({
      doc: (id: string) => ({
        set: (data: FirebaseFirestore.DocumentData) => {
          written.set(`${path}/${id}`, data);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db, written };
}

describe('vocabulary seed (GT-103)', () => {
  it('holds the A1 count in the 600 to 700 range', () => {
    const a1 = loadVocabSeedFile('A1');
    expect(a1.length).toBeGreaterThanOrEqual(600);
    expect(a1.length).toBeLessThanOrEqual(700);
  });

  it('seeds A1 without touching staged A2/B1 words', async () => {
    const { db, written } = fakeDb();
    const count = await seedVocabulary(db, 'A1');
    expect(count).toBe(loadVocabSeedFile('A1').length);
    expect(written.size).toBe(count);
    const a2Ids = new Set(loadVocabSeedFile('A2').map((word) => word.id));
    for (const key of written.keys()) {
      expect(a2Ids.has(key.replace('vocabulary/', ''))).toBe(false);
    }
  });

  it('writes A2 only when the staged loader is invoked for A2', async () => {
    const { db, written } = fakeDb();
    await seedVocabulary(db, 'A2');
    expect(written.size).toBe(loadVocabSeedFile('A2').length);
    expect(written.size).toBeGreaterThan(0);
  });

  it('is idempotent per level', async () => {
    const { db, written } = fakeDb();
    await seedVocabulary(db, 'A1');
    const snapshot = new Map(written);
    await seedVocabulary(db, 'A1');
    expect(written.size).toBe(snapshot.size);
  });
});

describe('day-set selection (GT-103)', () => {
  it('produces a set sharing exactly one theme, highest frequency first', () => {
    const corpus = loadVocabSeedFile('A1');
    const daySet = selectDaySet(corpus, new Set());
    expect(daySet).not.toBeNull();
    const themes = new Set(daySet?.words.map((word) => word.theme));
    expect(themes.size).toBe(1);
    const ranks = daySet?.words.map((word) => word.frequencyRank) ?? [];
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(daySet?.words.length).toBeGreaterThan(0);
    expect(daySet?.words.length).toBeLessThanOrEqual(15);
  });

  it('skips learned words and anchors on the next unlearned one', () => {
    const corpus = loadVocabSeedFile('A1');
    const sorted = [...corpus].sort((a, b) => a.frequencyRank - b.frequencyRank);
    const learned = new Set(sorted.slice(0, 40).map((word) => word.id));
    const daySet = selectDaySet(corpus, learned);
    expect(daySet).not.toBeNull();
    for (const word of daySet?.words ?? []) {
      expect(learned.has(word.id)).toBe(false);
    }
  });

  it('returns null when the corpus is exhausted', () => {
    const corpus = loadVocabSeedFile('A1');
    const all = new Set(corpus.map((word) => word.id));
    expect(selectDaySet(corpus, all)).toBeNull();
  });
});
