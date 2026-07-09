import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DevFileStore } from '@/lib/db/store';
import {
  passes,
  recordSkillScore,
  scoreObjectiveSection,
  scoreProductionSection,
  scoreUnitTest,
} from './scoring';
import type { UnitTest } from './unit-test-gen';

describe('per-skill scoring and gates (GT-302)', () => {
  it('18 of 30 items scores exactly 60 and passes', () => {
    const results = [...Array<boolean>(18).fill(true), ...Array<boolean>(12).fill(false)];
    const score = scoreObjectiveSection(results);
    expect(score).toBe(60);
    expect(passes(score)).toBe(true);
  });

  it('anything below 60 fails, 60 exactly passes', () => {
    expect(passes(59)).toBe(false);
    expect(passes(60)).toBe(true);
    // 17/30 rounds to 57: fails.
    const results = [...Array<boolean>(17).fill(true), ...Array<boolean>(13).fill(false)];
    expect(passes(scoreObjectiveSection(results))).toBe(false);
  });

  it('production rubric normalizes to 100 and caps at zero language score', () => {
    expect(
      scoreProductionSection({ errorCount: 0, contentPointsCovered: 3, contentPointsTotal: 3 }),
    ).toBe(100);
    expect(
      scoreProductionSection({ errorCount: 10, contentPointsCovered: 3, contentPointsTotal: 3 }),
    ).toBe(60);
    expect(
      scoreProductionSection({ errorCount: 2, contentPointsCovered: 2, contentPointsTotal: 3 }),
    ).toBe(64);
    expect(
      scoreProductionSection({ errorCount: 0, contentPointsCovered: 0, contentPointsTotal: 3 }),
    ).toBe(40);
  });

  it('scores a whole unit test per skill deterministically', () => {
    const test = {
      unitId: 'a1-4',
      listening: Array.from({ length: 4 }, (_, i) => ({
        stimulus: `s${i}`,
        question: 'q',
        options: ['a', 'b', 'c'],
        correctIndex: 0,
        grammarItemId: 'noun-genders-articles',
      })),
      reading: Array.from({ length: 4 }, (_, i) => ({
        stimulus: `r${i}`,
        question: 'q',
        options: ['a', 'b', 'c'],
        correctIndex: 0,
        grammarItemId: 'plural-die',
      })),
      writing: { instruction: 'w', contentPoints: ['1', '2', '3'], grammarItemIds: ['plural-die'] },
      speaking: { instruction: 's', contentPoints: ['1', '2'], grammarItemIds: ['plural-die'] },
    } satisfies UnitTest;

    const outcomes = scoreUnitTest(test, {
      listening: [true, true, true, false],
      reading: [true, false, false, false],
      writing: { errorCount: 1, contentPointsCovered: 3, contentPointsTotal: 3 },
      speaking: { errorCount: 5, contentPointsCovered: 1, contentPointsTotal: 2 },
    });
    expect(outcomes).toEqual([
      { skill: 'listening', score: 75, passed: true },
      { skill: 'reading', score: 25, passed: false },
      { skill: 'writing', score: 92, passed: true },
      { skill: 'speaking', score: 30, passed: false },
    ]);
  });

  it('rejects result counts that do not match the test', () => {
    const test = {
      unitId: 'a1-4',
      listening: [
        {
          stimulus: 's',
          question: 'q',
          options: ['a', 'b', 'c'],
          correctIndex: 0,
          grammarItemId: 'plural-die',
        },
      ],
      reading: [
        {
          stimulus: 'r',
          question: 'q',
          options: ['a', 'b', 'c'],
          correctIndex: 0,
          grammarItemId: 'plural-die',
        },
      ],
      writing: { instruction: 'w', contentPoints: ['1', '2'], grammarItemIds: ['plural-die'] },
      speaking: { instruction: 's', contentPoints: ['1', '2'], grammarItemIds: ['plural-die'] },
    } satisfies UnitTest;
    expect(() =>
      scoreUnitTest(test, {
        listening: [],
        reading: [true],
        writing: { errorCount: 0, contentPointsCovered: 2, contentPointsTotal: 2 },
        speaking: { errorCount: 0, contentPointsCovered: 2, contentPointsTotal: 2 },
      }),
    ).toThrow(/match the test/);
  });

  it('attempt history preserves both attempts after a retake', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'scoring-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await recordSkillScore(store, 'a1-4', 'writing', 55, '2026-07-09T08:00:00.000Z');
      const second = await recordSkillScore(
        store,
        'a1-4',
        'writing',
        72,
        '2026-07-10T08:00:00.000Z',
      );
      expect(second.attempts).toHaveLength(2);
      expect(second.attempts.map((attempt) => attempt.score)).toEqual([55, 72]);
      expect(second.score).toBe(72);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
