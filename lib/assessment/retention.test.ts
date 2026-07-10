import { describe, expect, it } from 'vitest';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import type { Unit } from '@/lib/db/curriculum';
import { buildWarmupQueue } from '@/lib/fsrs/queue';
import { introduceCard, rate } from '@/lib/fsrs/scheduler';
import { composeSession } from '@/lib/lesson/engine';
import type { RetentionScore } from '@/lib/db/learner';
import {
  applyLapses,
  applyRetestResult,
  decayedUnitIds,
  dueRetests,
  dueSchedulePoints,
  initialRetention,
  makeRetestInjector,
  needsRemediation,
  type PassedUnit,
} from './retention';

const passedAt = '2026-07-01T08:00:00.000Z';
const day = (offset: number) => new Date(new Date(passedAt).getTime() + offset * 86_400_000);

function passedUnit(overrides: Partial<PassedUnit> = {}): PassedUnit {
  return { unitId: 'a1-1', passedAt, retention: initialRetention('a1-1'), ...overrides };
}

describe('spaced retest scheduler (GT-304)', () => {
  it('the day-7 item appears in the first warm-up after day 7, not before', () => {
    expect(dueSchedulePoints(passedUnit(), day(6))).toEqual([]);
    const due = dueRetests([passedUnit()], day(7));
    expect(due).toEqual([{ retestId: 'retest-a1-1-d7', unitId: 'a1-1', schedulePointDays: 7 }]);

    const cards = [introduceCard('nicht-adverb', day(7))];
    const queue = buildWarmupQueue(cards, day(7), 10, makeRetestInjector(due));
    // The retest rides the same WarmupItem union: indistinguishable shape.
    expect(queue.map((item) => item.kind)).toEqual(['review', 'retest']);
  });

  it('a taken retest clears the point until the next one arrives', () => {
    const afterRetest = passedUnit({
      retention: { unitId: 'a1-1', score: 90, lastRetestAt: day(7).toISOString(), passedAt: null },
    });
    expect(dueSchedulePoints(afterRetest, day(8))).toEqual([]);
    expect(dueSchedulePoints(afterRetest, day(14))).toEqual([14]);
  });

  it('retest results update RetentionScore only, never FSRS card states', () => {
    const card = introduceCard('nicht-adverb', day(7));
    const before = { ...card };
    const updated = applyRetestResult(initialRetention('a1-1'), true, day(7).toISOString());
    expect(updated.score).toBe(90);
    expect(updated.lastRetestAt).toBe(day(7).toISOString());
    expect(card).toEqual(before);
    // Real reviews still rate normally alongside.
    expect(rate(card, 'good', day(7)).reps).toBe(1);
  });
});

describe('retention decay (GT-305)', () => {
  it('two failed retests drop the score below the threshold', () => {
    let retention = initialRetention('a1-1');
    retention = applyRetestResult(retention, false, day(7).toISOString());
    retention = applyRetestResult(retention, false, day(14).toISOString());
    expect(retention.score).toBe(50);
    expect(needsRemediation(retention)).toBe(true);
  });

  it('lapsed schedule points decay the score without any retest', () => {
    // Day 35: points 7, 14, 30 all due and untaken; two are lapsed.
    const lapsed = applyLapses(passedUnit(), day(35));
    expect(lapsed.score).toBe(60);
    const veryLapsed = applyLapses(passedUnit(), day(70));
    expect(veryLapsed.score).toBe(50);
  });

  it('a decayed unit inserts remediation into the next daily plan', () => {
    const failedTwice = passedUnit({
      retention: { unitId: 'a1-1', score: 50, lastRetestAt: day(14).toISOString(), passedAt: null },
    });
    const decayed = decayedUnitIds([failedTwice], day(15));
    expect(decayed).toEqual(['a1-1']);

    // The decayed unit's grammar items feed the lesson engine's resurfacing
    // seam; tomorrow's grammar focus targets them.
    const decayedUnit = seedUnits.find((unit) => unit.id === 'a1-1') as Unit;
    const currentUnit = seedUnits.find((unit) => unit.id === 'a1-4') as Unit;
    const session = composeSession({
      unit: currentUnit,
      unitGrammarItems: seedGrammarItems.filter(
        (item) =>
          currentUnit.grammarItemIds.includes(item.id) ||
          decayedUnit.grammarItemIds.includes(item.id),
      ),
      corpus: loadVocabSeedFile('A1'),
      learnedWordIds: new Set<string>(),
      cards: [],
      lastSkillSlot: null,
      poorGrammarItemIds: decayedUnit.grammarItemIds,
      now: day(16),
    });
    const grammarStep = session.steps.find((step) => step.kind === 'grammar-focus');
    expect(
      grammarStep?.kind === 'grammar-focus' &&
        decayedUnit.grammarItemIds.includes(grammarStep.grammarItemId),
    ).toBe(true);
  });

  it('a recovered unit resumes the normal schedule', () => {
    let retention: RetentionScore = {
      unitId: 'a1-1',
      score: 50,
      lastRetestAt: day(14).toISOString(),
      passedAt: null,
    };
    retention = applyRetestResult(retention, true, day(30).toISOString());
    retention = applyRetestResult(retention, true, day(31).toISOString());
    expect(retention.score).toBe(70);
    const recovered = passedUnit({ retention });
    expect(decayedUnitIds([recovered], day(31))).toEqual([]);
    // Day 60 point still arrives on schedule.
    expect(dueSchedulePoints(recovered, day(60))).toEqual([60]);
  });

  it('retention scores stay clamped to 0..100', () => {
    let retention = {
      unitId: 'a1-1',
      score: 5,
      lastRetestAt: null as string | null,
      passedAt: null as string | null,
    };
    retention = applyRetestResult(retention, false, day(7).toISOString());
    expect(retention.score).toBe(0);
    let high = {
      unitId: 'a1-1',
      score: 95,
      lastRetestAt: null as string | null,
      passedAt: null as string | null,
    };
    high = applyRetestResult(high, true, day(7).toISOString());
    expect(high.score).toBe(100);
  });
});
