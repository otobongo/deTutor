import { describe, expect, it } from 'vitest';
import { passes } from './scoring';
import {
  B1_EXAM_BLUEPRINT,
  moduleTimer,
  normalizeObjectiveModule,
  normalizeProductionModule,
  validateExamModule,
  type ExamModule,
} from './b1-exam';

function objectiveItems(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    stimulus: `${prefix}-${index}`,
    question: 'Frage?',
    options: ['a', 'b', 'c'],
    correctIndex: 0,
    grammarItemId: 'genitiv',
  }));
}

describe('B1 exit simulation (GT-307)', () => {
  it('the Lesen module carries 30 items across 5 parts in 65 minutes', () => {
    const lesen = B1_EXAM_BLUEPRINT.find((module) => module.skill === 'reading');
    expect(lesen?.parts).toHaveLength(5);
    expect(lesen?.parts.reduce((sum, part) => sum + part.items, 0)).toBe(30);
    expect(lesen?.minutes).toBe(65);
    const hoeren = B1_EXAM_BLUEPRINT.find((module) => module.skill === 'listening');
    expect(hoeren?.parts.reduce((sum, part) => sum + part.items, 0)).toBe(30);
  });

  it('assembly validation enforces the blueprint exactly', () => {
    const valid: ExamModule = {
      skill: 'reading',
      parts: B1_EXAM_BLUEPRINT[0]!.parts.map((spec) => ({
        part: spec.part,
        items: objectiveItems(spec.items, `p${spec.part}`),
      })),
      productionTasks: [],
    };
    expect(validateExamModule(valid)).toEqual([]);

    const short: ExamModule = {
      ...valid,
      parts: valid.parts.map((part) =>
        part.part === 3 ? { ...part, items: part.items.slice(0, 5) } : part,
      ),
    };
    const problems = validateExamModule(short);
    expect(problems.some((problem) => problem.includes('part 3'))).toBe(true);

    const writing: ExamModule = { skill: 'writing', parts: [], productionTasks: [] };
    expect(validateExamModule(writing)[0]).toContain('3');
  });

  it('the timer enforces module time', () => {
    const startedAt = '2026-07-09T08:00:00.000Z';
    const midway = moduleTimer('reading', startedAt, new Date('2026-07-09T08:30:00.000Z'));
    expect(midway.remainingSeconds).toBe(35 * 60);
    expect(midway.expired).toBe(false);
    const over = moduleTimer('reading', startedAt, new Date('2026-07-09T09:06:00.000Z'));
    expect(over.expired).toBe(true);
    expect(over.remainingSeconds).toBe(0);
    // Sprechen runs 15 minutes.
    const sprechen = moduleTimer('speaking', startedAt, new Date('2026-07-09T08:16:00.000Z'));
    expect(sprechen.expired).toBe(true);
  });

  it('module scores normalize to 100 with the 60 pass line', () => {
    expect(normalizeObjectiveModule('reading', 18)).toBe(60);
    expect(passes(normalizeObjectiveModule('reading', 18))).toBe(true);
    expect(passes(normalizeObjectiveModule('reading', 17))).toBe(false);
    expect(normalizeObjectiveModule('listening', 30)).toBe(100);
    expect(() => normalizeObjectiveModule('reading', 31)).toThrow(/0\.\.30/);
    expect(normalizeProductionModule([80, 60, 70])).toBe(70);
    expect(() => normalizeObjectiveModule('writing', 1)).toThrow(/not an objective module/);
  });
});
