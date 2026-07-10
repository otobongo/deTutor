import { describe, expect, it } from 'vitest';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { dialogueSchema, validateDialogueEnvelope } from '@/lib/exercises/dialogue';
import { A1_DIALOGUE_FALLBACKS, fallbackDialogueFor } from './dialogue-fallback';

describe('curated A1 dialogue fallbacks', () => {
  it('every dialogue is schema-valid and inside the A1 envelope over the real corpus', () => {
    const corpus = loadVocabSeedFile('A1');
    for (const dialogue of A1_DIALOGUE_FALLBACKS) {
      expect(() => dialogueSchema.parse(dialogue)).not.toThrow();
      expect(validateDialogueEnvelope(dialogue, 'A1', corpus)).toEqual([]);
    }
  });

  it('titles are unique and selection is deterministic by day', () => {
    const titles = new Set(A1_DIALOGUE_FALLBACKS.map((dialogue) => dialogue.title));
    expect(titles.size).toBe(A1_DIALOGUE_FALLBACKS.length);
    const day = new Date('2026-07-10T09:00:00.000Z');
    expect(fallbackDialogueFor(day).title).toBe(fallbackDialogueFor(day).title);
    expect(fallbackDialogueFor(new Date(day.getTime() + 86_400_000)).title).not.toBe(
      fallbackDialogueFor(day).title,
    );
  });
});
