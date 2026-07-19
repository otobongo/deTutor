import type { SessionStep } from '@/lib/db/learner';

// Minute estimates for the day's plan (GT-D6). The Today panel answers the
// question that actually stops someone starting on a busy evening: how long
// is this going to take. That answer has to come from the real plan, not a
// fixed "15 to 20 minutes" string, or it is just decoration.
//
// The per-item rates below are deliberately coarse. They are derived from the
// session's own shape (cards to review, words to learn) rather than measured
// telemetry, which does not exist yet, so the output is presented as an
// approximation and rounded to whole minutes.

// Seconds per unit of work, by step kind.
const SECONDS_PER_REVIEW_CARD = 8;
const SECONDS_PER_NEW_WORD = 14;
const SECONDS_GRAMMAR_FOCUS = 180;
const SECONDS_WRAP_UP = 90;

// Skill slots differ enough in length to be worth separating: a listening
// dialogue with replay runs longer than an echo repetition.
const SECONDS_BY_SLOT: Readonly<Record<string, number>> = {
  listening: 360,
  reading: 330,
  writing: 300,
  scenario: 420,
};

const SECONDS_SKILL_FALLBACK = 330;

// warmupCards overrides the step's own queue length when given. Due retests
// ride the warm-up disguised as reviews (GT-304), so the cards the learner
// actually answers can outnumber queueWordIds; the caller that knows the real
// figure passes it rather than letting the estimate run short.
export function estimateStepSeconds(step: SessionStep, warmupCards?: number): number {
  switch (step.kind) {
    case 'warm-up':
      return (warmupCards ?? step.queueWordIds.length) * SECONDS_PER_REVIEW_CARD;
    case 'new-vocabulary':
      return step.wordIds.length * SECONDS_PER_NEW_WORD;
    case 'grammar-focus':
      return SECONDS_GRAMMAR_FOCUS;
    case 'skill-practice':
      return SECONDS_BY_SLOT[step.slot] ?? SECONDS_SKILL_FALLBACK;
    case 'wrap-up':
      return SECONDS_WRAP_UP;
  }
}

export function estimateStepMinutes(step: SessionStep, warmupCards?: number): number {
  // A step that exists always reads as at least a minute: rounding a short
  // warm-up down to "0 min" would look like it had been skipped.
  return Math.max(1, Math.round(estimateStepSeconds(step, warmupCards) / 60));
}

// Total is computed from raw seconds, not from the per-step rounded minutes,
// so the panel's total never disagrees with reality by the sum of five
// rounding errors.
export function estimateSessionMinutes(
  steps: readonly SessionStep[],
  warmupCards?: number,
): number {
  const seconds = steps.reduce((sum, step) => sum + estimateStepSeconds(step, warmupCards), 0);
  return Math.max(1, Math.round(seconds / 60));
}
