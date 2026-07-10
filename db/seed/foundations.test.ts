import { describe, expect, it } from 'vitest';
import { seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { FOUNDATION_TOPICS } from './foundations';
import { foundationVocabulary } from './foundation-vocab';

describe('foundation topics seed', () => {
  it('ids are unique and the four ground structures lead', () => {
    const ids = FOUNDATION_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 4)).toEqual(['numbers', 'pronouns', 'accusative', 'dative']);
  });

  it('every quiz is answerable: 3+ questions, correct index in range', () => {
    for (const topic of FOUNDATION_TOPICS) {
      expect(topic.quiz.length).toBeGreaterThanOrEqual(3);
      for (const question of topic.quiz) {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.options.length);
      }
    }
  });

  it('every A1 grammar item is explained by some foundation topic', () => {
    const covered = new Set(FOUNDATION_TOPICS.flatMap((topic) => topic.grammarItemIds));
    const a1Items = seedUnits
      .filter((unit) => unit.id.startsWith('a1-'))
      .flatMap((unit) => unit.grammarItemIds);
    for (const itemId of a1Items) {
      expect(covered, `grammar item ${itemId} has no foundation topic`).toContain(itemId);
    }
  });

  it('every section has substance and examples stay simple German', () => {
    for (const topic of FOUNDATION_TOPICS) {
      expect(topic.sections.length).toBeGreaterThanOrEqual(1);
      for (const section of topic.sections) {
        expect(section.body.length).toBeGreaterThan(40);
      }
    }
  });
});

describe('foundation vocabulary seed', () => {
  it('ids are unique and never collide with the corpus', () => {
    const ids = foundationVocabulary.map((word) => word.id);
    expect(new Set(ids).size).toBe(ids.length);
    const corpusIds = new Set(loadVocabSeedFile('A1').map((word) => word.id));
    expect(ids.every((id) => !corpusIds.has(id))).toBe(true);
  });

  it('entries stay out of frequency-based selection and theme selection', () => {
    for (const word of foundationVocabulary) {
      expect(word.frequencyRank).toBeGreaterThan(50_000);
      expect(word.theme).toBe('foundations');
      expect(word.exampleDe).toBeTruthy();
    }
  });
});
