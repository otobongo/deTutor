import { describe, expect, it } from 'vitest';
import type { Article } from '@/lib/db/curriculum';
import { ingest, parseWortlisteLine, picturableFor, slugify, themeFor } from './core';

const genusByLemma = new Map<string, Set<Article>>([
  ['Tisch', new Set<Article>(['der'])],
  ['Haus', new Set<Article>(['das'])],
  ['Katze', new Set<Article>(['die'])],
  ['Butter', new Set<Article>(['die'])],
]);

const frequencyRanks = new Map<string, number>([
  ['und', 1],
  ['tisch', 50],
  ['haus', 60],
  ['katze', 70],
  ['butter', 80],
  ['gehen', 90],
]);

const baseInputs = {
  vocabforgeRows: [
    { lemma: 'gehen', category: 'verbs', translation: 'to go', article: '' },
    { lemma: 'Tisch', category: 'nouns', translation: 'table', article: 'der' },
  ],
  genusByLemma,
  frequencyRanks,
  curated: {
    und: { translation: 'and', wordType: 'other' as const },
    Haus: { translation: 'house', wordType: 'noun' as const },
    Katze: { translation: 'cat', wordType: 'noun' as const },
    Butter: { translation: 'butter', wordType: 'noun' as const },
  },
  themeOverrides: {},
  picturableOverrides: {},
  levelBands: { a1: 3, a2: 2 },
};

describe('parseWortlisteLine (GT-102)', () => {
  it('parses article-annotated nouns', () => {
    expect(parseWortlisteLine('das Haus, -̈er')).toEqual({
      raw: 'das Haus, -̈er',
      lemma: 'Haus',
      article: 'das',
      pluralOnly: false,
    });
  });

  it('parses verb conjugation rows to the infinitive lemma', () => {
    expect(parseWortlisteLine('haben, hat, hatte, hat gehabt')?.lemma).toBe('haben');
  });

  it('strips parentheticals, exclamation marks, and slash variants', () => {
    expect(parseWortlisteLine('Abgase (Pl.)')?.lemma).toBe('Abgase');
    expect(parseWortlisteLine('Abgase (Pl.)')?.pluralOnly).toBe(true);
    expect(parseWortlisteLine('Achtung!')?.lemma).toBe('Achtung');
    expect(parseWortlisteLine('die Hausfrau/der Hausmann')?.lemma).toBe('Hausfrau');
  });
});

describe('ingest (GT-102)', () => {
  it('flags a planted wrong-article row for review instead of writing it', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: ['der Haus, -̈er', 'der Tisch, -e', 'und'],
    });
    expect(result.words.map((word) => word.german)).not.toContain('Haus');
    expect(result.articleReview).toEqual([
      { lemma: 'Haus', claimed: 'der', allowed: ['das'], reason: 'mismatch' },
    ]);
  });

  it('flags nouns absent from german-nouns as unverified, never writing them', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: ['die Quasselstrippe, -n'],
      curated: {
        ...baseInputs.curated,
        Quasselstrippe: { translation: 'chatterbox', wordType: 'noun' as const },
      },
    });
    expect(result.words).toHaveLength(0);
    expect(result.articleReview[0]?.reason).toBe('unverified');
  });

  it('excludes words beyond the Wortliste corpus entirely', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: ['der Tisch, -e'],
      vocabforgeRows: [
        ...baseInputs.vocabforgeRows,
        {
          lemma: 'Quantenphysik',
          category: 'nouns',
          translation: 'quantum physics',
          article: 'die',
        },
      ],
    });
    expect(result.words.map((word) => word.german)).toEqual(['Tisch']);
  });

  it('verifies plurale tantum nouns as die by rule', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: ['die Leute (Pl.)'],
      curated: {
        ...baseInputs.curated,
        Leute: { translation: 'people', wordType: 'noun' as const },
      },
    });
    expect(result.words[0]?.german).toBe('Leute');
    expect(result.words[0]?.article).toBe('die');
    expect(result.articleReview).toHaveLength(0);
  });

  it('routes words without any translation source to the pending ledger', () => {
    const result = ingest({ ...baseInputs, wortlisteLines: ['schnurpseln'] });
    expect(result.words).toHaveLength(0);
    expect(result.translationPending[0]?.lemma).toBe('schnurpseln');
  });

  it('assigns levels by frequency band, most frequent first', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: [
        'und',
        'der Tisch, -e',
        'das Haus, -̈er',
        'die Katze, -n',
        'die Butter',
        'gehen',
      ],
    });
    const byGerman = new Map(result.words.map((word) => [word.german, word]));
    expect(result.words).toHaveLength(6);
    expect(byGerman.get('und')?.cefrLevel).toBe('A1');
    expect(byGerman.get('Tisch')?.cefrLevel).toBe('A1');
    expect(byGerman.get('Haus')?.cefrLevel).toBe('A1');
    expect(byGerman.get('Katze')?.cefrLevel).toBe('A2');
    expect(byGerman.get('Butter')?.cefrLevel).toBe('A2');
    expect(byGerman.get('gehen')?.cefrLevel).toBe('B1');
  });

  it('is idempotent: identical inputs produce identical outputs', () => {
    const inputs = {
      ...baseInputs,
      wortlisteLines: ['und', 'der Tisch, -e', 'gehen'],
    };
    expect(ingest(inputs)).toEqual(ingest(inputs));
  });

  it('gives every word level, theme, rank, and picturable', () => {
    const result = ingest({
      ...baseInputs,
      wortlisteLines: ['der Tisch, -e', 'die Butter', 'gehen'],
    });
    for (const word of result.words) {
      expect(['A1', 'A2', 'B1']).toContain(word.cefrLevel);
      expect(word.theme.length).toBeGreaterThan(0);
      expect(word.frequencyRank).toBeGreaterThan(0);
      expect(typeof word.picturable).toBe('boolean');
    }
    const tisch = result.words.find((word) => word.german === 'Tisch');
    expect(tisch?.theme).toBe('home-living');
    expect(tisch?.picturable).toBe(true);
  });
});

describe('helpers (GT-102)', () => {
  it('maps translations to themes with override precedence', () => {
    expect(themeFor('table', undefined)).toBe('home-living');
    expect(themeFor('table', 'custom-theme')).toBe('custom-theme');
    expect(themeFor('epistemology', undefined)).toBe('general');
  });

  it('marks abstract-suffix nouns non-picturable', () => {
    expect(picturableFor('Wohnung', 'noun', 'home-living', undefined)).toBe(false);
    expect(picturableFor('Tisch', 'noun', 'home-living', undefined)).toBe(true);
    expect(picturableFor('Wohnung', 'noun', 'home-living', true)).toBe(true);
  });

  it('slugifies umlauts and eszett deterministically', () => {
    expect(slugify('Brötchen')).toBe('broetchen');
    expect(slugify('Fuß')).toBe('fuss');
    expect(slugify('U-Bahn')).toBe('u-bahn');
  });
});
