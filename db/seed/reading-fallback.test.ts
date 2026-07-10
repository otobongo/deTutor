import { describe, expect, it } from 'vitest';
import { richtigFalschTaskSchema, scoreReadingTask } from '@/lib/exercises/reading-tasks';
import { LENGTH_CAP_WORDS, tokenizeGerman } from '@/lib/exercises/reading-gen';
import { A1_READING_FALLBACKS, fallbackReadingFor } from './reading-fallback';

describe('curated A1 reading fallbacks', () => {
  it('every exercise is a valid richtig/falsch task within the A1 length cap', () => {
    for (const exercise of A1_READING_FALLBACKS) {
      expect(() => richtigFalschTaskSchema.parse(exercise.task)).not.toThrow();
      expect(tokenizeGerman(exercise.task.text).length).toBeLessThanOrEqual(LENGTH_CAP_WORDS.A1);
      expect(['sign', 'note']).toContain(exercise.format);
      expect(exercise.task.items.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('ids are unique and the answer keys score perfectly against themselves', () => {
    const ids = new Set(A1_READING_FALLBACKS.map((exercise) => exercise.id));
    expect(ids.size).toBe(A1_READING_FALLBACKS.length);
    for (const exercise of A1_READING_FALLBACKS) {
      const perfect = scoreReadingTask(exercise.task, {
        format: 'richtig-falsch',
        answers: exercise.task.items.map((item) => item.answer),
      });
      expect(perfect.score).toBe(100);
    }
  });

  it('selection is deterministic by day and always lands on a curated exercise', () => {
    const day = new Date('2026-07-10T09:00:00.000Z');
    const first = fallbackReadingFor(day);
    const second = fallbackReadingFor(new Date(day.getTime() + 3_600_000));
    expect(first.id).toBe(second.id);
    const nextDay = fallbackReadingFor(new Date(day.getTime() + 86_400_000));
    expect(A1_READING_FALLBACKS.map((exercise) => exercise.id)).toContain(nextDay.id);
    expect(nextDay.id).not.toBe(first.id);
  });
});
