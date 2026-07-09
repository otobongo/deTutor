import { describe, expect, it } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { introduceCard, rate } from '@/lib/fsrs/scheduler';
import { buildRecognitionExercise, gradeProduction, gradeRecognition } from './image-id';

const nowIso = '2026-07-09T08:00:00.000Z';

function noun(
  id: string,
  german: string,
  article: 'der' | 'die' | 'das',
  overrides = {},
): VocabularyWord {
  return {
    id,
    german,
    wordType: 'noun',
    article,
    translation: german.toLowerCase(),
    ipa: null,
    exampleDe: null,
    exampleEn: null,
    cefrLevel: 'A1',
    theme: 'home-living',
    picturable: true,
    frequencyRank: 100,
    ...overrides,
  };
}

const tisch = noun('tisch-noun', 'Tisch', 'der');
const corpus = [
  tisch,
  noun('stuhl-noun', 'Stuhl', 'der', { frequencyRank: 110 }),
  noun('lampe-noun', 'Lampe', 'die', { frequencyRank: 120 }),
  noun('fenster-noun', 'Fenster', 'das', { frequencyRank: 130 }),
  noun('katze-noun', 'Katze', 'die', { theme: 'nature-weather', frequencyRank: 105 }),
];

describe('image recognition (GT-202)', () => {
  it('refuses non-picturable words', () => {
    const abstract = noun('idee-noun', 'Idee', 'die', { picturable: false });
    expect(() => buildRecognitionExercise(abstract, corpus)).toThrow(/not picturable/);
  });

  it('builds 3 to 4 plausible options with no duplicates, same theme preferred', () => {
    const exercise = buildRecognitionExercise(tisch, corpus);
    expect(exercise.options.length).toBeGreaterThanOrEqual(3);
    expect(exercise.options.length).toBeLessThanOrEqual(4);
    const labels = exercise.options.map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
    const distractors = exercise.options.filter((option) => option.kind === 'distractor');
    expect(distractors.map((option) => option.wordId)).toEqual(['stuhl-noun', 'lampe-noun']);
  });

  it('is deterministic', () => {
    expect(buildRecognitionExercise(tisch, corpus)).toEqual(
      buildRecognitionExercise(tisch, corpus),
    );
  });

  it('confirms the correct choice without logging', () => {
    const exercise = buildRecognitionExercise(tisch, corpus);
    const result = gradeRecognition(exercise, tisch, 'tisch-noun', nowIso);
    expect(result.correct).toBe(true);
    expect(result.logEntry).toBeNull();
  });

  it('logs a gender error when the article trap is chosen', () => {
    const exercise = buildRecognitionExercise(tisch, corpus);
    const trap = exercise.options.find((option) => option.kind === 'article-trap');
    expect(trap).toBeDefined();
    const result = gradeRecognition(exercise, tisch, trap?.wordId ?? '', nowIso);
    expect(result.correct).toBe(false);
    expect(result.correctLabel).toBe('der Tisch');
    expect(result.logEntry?.category).toBe('gender');
  });

  it('does not log for a plain vocabulary miss', () => {
    const exercise = buildRecognitionExercise(tisch, corpus);
    const result = gradeRecognition(exercise, tisch, 'lampe-noun', nowIso);
    expect(result.correct).toBe(false);
    expect(result.logEntry).toBeNull();
  });
});

describe('image production (GT-203)', () => {
  it('scores "Tisch" without "der" as partial and logs gender', () => {
    const result = gradeProduction(tisch, 'Tisch', nowIso);
    expect(result.verdict).toBe('partial');
    expect(result.rating).toBe('hard');
    expect(result.logEntry?.category).toBe('gender');
  });

  it('scores the wrong article as partial with a gender log', () => {
    const result = gradeProduction(tisch, 'die Tisch', nowIso);
    expect(result.verdict).toBe('partial');
    expect(result.logEntry?.category).toBe('gender');
  });

  it('maps a fully correct production to Good', () => {
    const result = gradeProduction(tisch, '  der tisch ', nowIso);
    expect(result.verdict).toBe('full');
    expect(result.rating).toBe('good');
    expect(result.logEntry).toBeNull();
  });

  it('maps a wrong word to Again without a gender log', () => {
    const result = gradeProduction(tisch, 'der Stuhl', nowIso);
    expect(result.verdict).toBe('wrong');
    expect(result.rating).toBe('again');
    expect(result.logEntry).toBeNull();
  });

  it('production results update the FSRS card via the derived rating', () => {
    const card = introduceCard(tisch.id, new Date(nowIso));
    const result = gradeProduction(tisch, 'der Tisch', nowIso);
    const updated = rate(card, result.rating, new Date(nowIso));
    expect(updated.reps).toBe(card.reps + 1);
    expect(updated.phase).not.toBe('new');
  });
});
