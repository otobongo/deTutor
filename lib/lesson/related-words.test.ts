import { describe, expect, it } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { relatedWordsFor } from './related-words';

function word(overrides: Partial<VocabularyWord> & { id: string; german: string }): VocabularyWord {
  return {
    wordType: 'noun',
    article: 'die',
    translation: 'x',
    ipa: null,
    exampleDe: null,
    exampleEn: null,
    cefrLevel: 'A1',
    theme: 'city-transport',
    picturable: true,
    frequencyRank: 100,
    ...overrides,
  };
}

const karte = word({ id: 'karte-noun', german: 'Karte', frequencyRank: 100 });
const fahrkarte = word({ id: 'fahrkarte-noun', german: 'Fahrkarte', frequencyRank: 300 });
const speisekarte = word({ id: 'speisekarte-noun', german: 'Speisekarte', frequencyRank: 500 });
const zug = word({ id: 'zug-noun', german: 'Zug', article: 'der', frequencyRank: 90 });
const bus = word({ id: 'bus-noun', german: 'Bus', article: 'der', frequencyRank: 120 });
const brot = word({ id: 'brot-noun', german: 'Brot', article: 'das', theme: 'food-drink' });

const corpus = [karte, fahrkarte, speisekarte, zug, bus, brot];

describe('word neighborhood (related words)', () => {
  it('family members (shared stem, compounds) come first, then theme neighbors by frequency', () => {
    const related = relatedWordsFor(karte, corpus);
    expect(related.map((entry) => entry.word.id)).toEqual([
      'fahrkarte-noun',
      'speisekarte-noun',
      'zug-noun',
      'bus-noun',
    ]);
    expect(related[0]?.relation).toBe('family');
    expect(related[2]?.relation).toBe('theme');
  });

  it('never includes the target itself, other themes, or duplicates, and respects max', () => {
    const related = relatedWordsFor(karte, corpus, 2);
    expect(related).toHaveLength(2);
    expect(related.every((entry) => entry.word.id !== karte.id)).toBe(true);
    expect(related.every((entry) => entry.word.id !== brot.id)).toBe(true);
  });

  it('is deterministic', () => {
    expect(relatedWordsFor(zug, corpus)).toEqual(relatedWordsFor(zug, corpus));
  });
});
