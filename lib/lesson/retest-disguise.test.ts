import { describe, expect, it } from 'vitest';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { disguiseWordFor } from './retest-disguise';

describe('disguised retest faces', () => {
  const corpus = loadVocabSeedFile('A1');

  it('is deterministic per retest id and always lands on a corpus word', () => {
    const first = disguiseWordFor('retest-a1-1-d7', corpus);
    expect(first).not.toBeNull();
    expect(disguiseWordFor('retest-a1-1-d7', corpus)).toEqual(first);
    expect(corpus.some((word) => word.id === first?.id)).toBe(true);
  });

  it('different schedule points wear different faces (no repeat drilling)', () => {
    const d7 = disguiseWordFor('retest-a1-1-d7', corpus);
    const d14 = disguiseWordFor('retest-a1-1-d14', corpus);
    expect(d7?.id).not.toBe(d14?.id);
  });

  it('an empty corpus yields null, never a crash', () => {
    expect(disguiseWordFor('retest-a1-1-d7', [])).toBeNull();
  });
});
