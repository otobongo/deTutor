import { describe, expect, it } from 'vitest';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { allLearnGroups } from '@/db/seed/learn-groups';
import { buildWordGroups, GROUP_CHUNK_SIZE } from './groups';

describe('learn word groups', () => {
  const corpus = loadVocabSeedFile('A1');

  it('every A1 corpus word lands in exactly one group', () => {
    const groups = buildWordGroups(corpus);
    const seen = new Map<string, number>();
    for (const group of groups) {
      for (const word of group.words) {
        seen.set(word.id, (seen.get(word.id) ?? 0) + 1);
      }
    }
    expect(seen.size).toBe(corpus.length);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);
  });

  it('no group exceeds the chunk size and ids are unique', () => {
    const groups = buildWordGroups(corpus);
    expect(groups.every((group) => group.words.length <= GROUP_CHUNK_SIZE)).toBe(true);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
  });

  it('the full Learn shelf leads with the foundation sets and is deterministic', () => {
    const groups = allLearnGroups(corpus);
    expect(groups[0]?.id).toBe('foundation-numbers');
    expect(groups[1]?.id).toBe('foundation-pronouns');
    expect(groups.map((group) => group.id)).toEqual(
      allLearnGroups(corpus).map((group) => group.id),
    );
  });
});
