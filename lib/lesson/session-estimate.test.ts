import { describe, expect, it } from 'vitest';
import type { SessionStep } from '@/lib/db/learner';
import {
  estimateSessionMinutes,
  estimateStepMinutes,
  estimateStepSeconds,
} from './session-estimate';

const warmUp = (cards: number): SessionStep => ({
  kind: 'warm-up',
  queueWordIds: Array.from({ length: cards }, (_, index) => `w-${index}`),
});

const newVocab = (words: number): SessionStep => ({
  kind: 'new-vocabulary',
  wordIds: Array.from({ length: words }, (_, index) => `v-${index}`),
  theme: 'general',
});

const grammar: SessionStep = { kind: 'grammar-focus', grammarItemId: 'g-1' };
const wrapUp: SessionStep = { kind: 'wrap-up' };

describe('session estimates (GT-D6)', () => {
  it('scales the warm-up with the number of review cards', () => {
    expect(estimateStepSeconds(warmUp(0))).toBe(0);
    expect(estimateStepSeconds(warmUp(12))).toBe(96);
    expect(estimateStepSeconds(warmUp(24))).toBe(192);
  });

  it('scales new vocabulary with the number of words', () => {
    expect(estimateStepSeconds(newVocab(5))).toBe(70);
    expect(estimateStepSeconds(newVocab(15))).toBe(210);
  });

  it('separates skill slots, since a dialogue is not an echo', () => {
    const listening = estimateStepSeconds({ kind: 'skill-practice', slot: 'listening' });
    const writing = estimateStepSeconds({ kind: 'skill-practice', slot: 'writing' });
    const scenario = estimateStepSeconds({ kind: 'skill-practice', slot: 'scenario' });
    expect(writing).toBeLessThan(listening);
    expect(listening).toBeLessThan(scenario);
  });

  it('never shows a real step as zero minutes', () => {
    // A day-one warm-up has no cards due, but the step still happens; "0 min"
    // would read as skipped rather than short.
    expect(estimateStepMinutes(warmUp(0))).toBe(1);
    expect(estimateStepMinutes(warmUp(1))).toBe(1);
  });

  it('totals from raw seconds rather than summing rounded minutes', () => {
    // Five steps that each round down would understate the total if the sum
    // were taken after rounding; this pins the total against that drift.
    const steps: SessionStep[] = [
      warmUp(12),
      newVocab(15),
      grammar,
      { kind: 'skill-practice', slot: 'listening' },
      wrapUp,
    ];
    const rawSeconds = 96 + 210 + 180 + 360 + 90;
    expect(estimateSessionMinutes(steps)).toBe(Math.round(rawSeconds / 60));
    expect(estimateSessionMinutes(steps)).toBe(16);
  });

  it('counts disguised retests, which the step itself does not list (GT-304)', () => {
    // queueWordIds has 4 reviews, but 6 cards will actually be answered once
    // due retests are injected. The estimate must follow the real figure or
    // the panel promises a shorter session than the learner gets.
    const step = warmUp(4);
    expect(estimateStepSeconds(step)).toBe(32);
    expect(estimateStepSeconds(step, 6)).toBe(48);
    expect(estimateSessionMinutes([step], 6)).toBe(1);
  });

  it('grows with the work in the plan', () => {
    const light: SessionStep[] = [warmUp(0), newVocab(5), grammar, wrapUp];
    const heavy: SessionStep[] = [warmUp(30), newVocab(20), grammar, wrapUp];
    expect(estimateSessionMinutes(heavy)).toBeGreaterThan(estimateSessionMinutes(light));
  });
});
