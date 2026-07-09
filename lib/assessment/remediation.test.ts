import { describe, expect, it } from 'vitest';
import { seedUnits } from '@/db/seed/units';
import type { Unit } from '@/lib/db/curriculum';
import { createGeminiClient, GeminiError, type GeminiTransport } from '@/lib/gemini/client';
import {
  applyRetake,
  canRetake,
  completeRemediation,
  failedObjectiveItems,
  generateRemediation,
  startUnitProgress,
  unitComplete,
} from './remediation';
import type { UnitTest } from './unit-test-gen';

const unit = seedUnits.find((candidate) => candidate.id === 'a1-4') as Unit;

const outcomes = [
  { skill: 'listening' as const, score: 75, passed: true },
  { skill: 'reading' as const, score: 80, passed: true },
  { skill: 'writing' as const, score: 45, passed: false },
  { skill: 'speaking' as const, score: 70, passed: true },
];

function clientWith(responses: string[]) {
  const transport: GeminiTransport = {
    generate: () => {
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  return createGeminiClient(transport, { fast: 'f', deep: 'd' }, () => {});
}

describe('remediation and single-skill retake (GT-303)', () => {
  it('failing writing locks only the writing retake behind remediation', () => {
    const progress = startUnitProgress('a1-4', outcomes);
    expect(progress.remediation).toEqual({ writing: 'pending' });
    expect(canRetake(progress, 'writing')).toBe(false);
    // Passed skills cannot be retaken at all.
    expect(() => applyRetake(progress, 'listening', 90)).toThrow(/already passed/);
    expect(() => applyRetake(progress, 'writing', 90)).toThrow(/locked/);
  });

  it('completing remediation unlocks the retake; passing it completes the unit', () => {
    let progress = startUnitProgress('a1-4', outcomes);
    progress = completeRemediation(progress, 'writing');
    expect(canRetake(progress, 'writing')).toBe(true);
    progress = applyRetake(progress, 'writing', 68);
    expect(progress.skills.writing).toEqual({ score: 68, passed: true });
    expect(unitComplete(progress)).toBe(true);
    // Other skills untouched by the whole flow.
    expect(progress.skills.listening.score).toBe(75);
  });

  it('a failed retake keeps the unit open for another remediated attempt', () => {
    let progress = startUnitProgress('a1-4', outcomes);
    progress = completeRemediation(progress, 'writing');
    progress = applyRetake(progress, 'writing', 50);
    expect(unitComplete(progress)).toBe(false);
    expect(progress.skills.writing.passed).toBe(false);
  });

  it('extracts exactly the failed objective items', () => {
    const item = (id: string, grammarItemId: string) => ({
      stimulus: id,
      question: `q-${id}`,
      options: ['a', 'b', 'c'],
      correctIndex: 0,
      grammarItemId,
    });
    const test: UnitTest = {
      unitId: 'a1-4',
      listening: [item('l1', 'noun-genders-articles'), item('l2', 'plural-die')],
      reading: [item('r1', 'plural-die')],
      writing: { instruction: 'w', contentPoints: ['1', '2'], grammarItemIds: ['plural-die'] },
      speaking: { instruction: 's', contentPoints: ['1', '2'], grammarItemIds: ['plural-die'] },
    };
    const failed = failedObjectiveItems(test, 'listening', [false, true]);
    expect(failed.map((entry) => entry.stimulus)).toEqual(['l1']);
  });

  it('remediation exercises must target the failed grammar items', async () => {
    const failedItems = [
      {
        stimulus: 's',
        question: 'Welcher Artikel?',
        options: ['der', 'die', 'das'],
        correctIndex: 0,
        grammarItemId: 'noun-genders-articles',
      },
    ];
    const good = JSON.stringify({
      exercises: [
        {
          grammarItemId: 'noun-genders-articles',
          instruction: 'Sort 10 nouns into der/die/das columns.',
          kind: 'drill',
        },
      ],
    });
    const plan = await generateRemediation(clientWith([good]), {
      unit,
      skill: 'listening',
      failedItems,
    });
    expect(plan.exercises[0]?.grammarItemId).toBe('noun-genders-articles');

    const offTarget = JSON.stringify({
      exercises: [{ grammarItemId: 'dativ-intro', instruction: 'Dativ drill', kind: 'drill' }],
    });
    const failure = await generateRemediation(clientWith([offTarget, offTarget]), {
      unit,
      skill: 'listening',
      failedItems,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).message).toContain('untested item');
  });
});
