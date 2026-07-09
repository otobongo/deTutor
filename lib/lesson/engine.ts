import type { GrammarItem, Unit, VocabularyWord } from '@/lib/db/curriculum';
import type { FsrsCardState, LessonSession, SessionStep, SkillSlot } from '@/lib/db/learner';
import { SKILL_SLOTS, lessonSessionSchema } from '@/lib/db/learner';
import { buildWarmupQueue, type InjectExtras, noExtras } from '@/lib/fsrs/queue';
import { selectDaySet } from './vocab-selection';

// The daily lesson engine (GT-108): the only composer of the five-step daily
// flow (PRD session structure). Pure composition; persistence of the session
// document happens at the caller's edge via lessonSessionConverter.

export const WARMUP_LIMIT = 12;

export interface ComposeSessionInputs {
  readonly unit: Unit;
  readonly unitGrammarItems: readonly GrammarItem[];
  readonly corpus: readonly VocabularyWord[];
  readonly learnedWordIds: ReadonlySet<string>;
  readonly cards: readonly FsrsCardState[];
  // Slot practiced in the previous session; rotation continues from here.
  readonly lastSkillSlot: SkillSlot | null;
  // Grammar items scored poorly (below 6/10) in recent sessions; the first
  // one belonging to this unit resurfaces (adaptation rule).
  readonly poorGrammarItemIds: readonly string[];
  readonly now: Date;
  readonly injectExtras?: InjectExtras;
}

function sessionIdFor(now: Date): string {
  return `session-${now.toISOString().slice(0, 10)}`;
}

// Deterministic, weight-proportional grammar selection: expand the unit's
// items by weight and index by day ordinal, so over time a 3x item appears
// three times as often as a 1x item, with no RNG to break auditability.
export function selectGrammarItem(
  unitItems: readonly GrammarItem[],
  poorGrammarItemIds: readonly string[],
  now: Date,
): GrammarItem {
  const resurfaced = unitItems.find((item) => poorGrammarItemIds.includes(item.id));
  if (resurfaced) return resurfaced;
  const expanded = unitItems.flatMap((item) => Array<GrammarItem>(item.weight).fill(item));
  if (expanded.length === 0) {
    throw new Error('A unit must carry at least one grammar item.');
  }
  const dayOrdinal = Math.floor(now.getTime() / 86_400_000);
  return expanded[dayOrdinal % expanded.length] as GrammarItem;
}

export function nextSkillSlot(lastSkillSlot: SkillSlot | null): SkillSlot {
  if (lastSkillSlot === null) return SKILL_SLOTS[0];
  const index = SKILL_SLOTS.indexOf(lastSkillSlot);
  return SKILL_SLOTS[(index + 1) % SKILL_SLOTS.length] as SkillSlot;
}

export function composeSession(inputs: ComposeSessionInputs): LessonSession {
  const warmup = buildWarmupQueue(
    inputs.cards,
    inputs.now,
    WARMUP_LIMIT,
    inputs.injectExtras ?? noExtras,
  );
  const daySet = selectDaySet(inputs.corpus, inputs.learnedWordIds);
  const grammarItem = selectGrammarItem(
    inputs.unitGrammarItems,
    inputs.poorGrammarItemIds,
    inputs.now,
  );

  const steps: SessionStep[] = [
    {
      kind: 'warm-up',
      queueWordIds: warmup
        .filter((item) => item.kind === 'review')
        .map((item) => (item.kind === 'review' ? item.card.wordId : '')),
    },
    {
      kind: 'new-vocabulary',
      theme: daySet?.theme ?? 'review',
      wordIds: daySet?.words.map((word) => word.id) ?? ['none'],
    },
    { kind: 'grammar-focus', grammarItemId: grammarItem.id },
    { kind: 'skill-practice', slot: nextSkillSlot(inputs.lastSkillSlot) },
    { kind: 'wrap-up' },
  ];

  return lessonSessionSchema.parse({
    id: sessionIdFor(inputs.now),
    unitId: inputs.unit.id,
    createdAt: inputs.now.toISOString(),
    currentStepIndex: 0,
    steps,
    status: 'active',
    grammarScore: null,
  });
}

export function currentStep(session: LessonSession): SessionStep {
  return session.steps[session.currentStepIndex] as SessionStep;
}

export interface StepCompletion {
  // Chunk-then-produce (PRD 3.4 rule 2): every content step requires learner
  // production before the session advances.
  readonly learnerProduced: boolean;
  // Required when completing the wrap-up: the grammar self-score (0 to 10).
  readonly grammarScore?: number;
}

const PRODUCTION_REQUIRED: ReadonlySet<SessionStep['kind']> = new Set([
  'warm-up',
  'new-vocabulary',
  'grammar-focus',
  'skill-practice',
]);

export function completeStep(session: LessonSession, completion: StepCompletion): LessonSession {
  if (session.status === 'completed') {
    throw new Error('Session already completed.');
  }
  const step = currentStep(session);
  if (PRODUCTION_REQUIRED.has(step.kind) && !completion.learnerProduced) {
    throw new Error(
      `Step "${step.kind}" requires learner production before advancing (chunk-then-produce).`,
    );
  }
  if (step.kind === 'wrap-up') {
    if (completion.grammarScore === undefined) {
      throw new Error('Wrap-up requires the grammar score for the practiced rule.');
    }
    return lessonSessionSchema.parse({
      ...session,
      status: 'completed',
      grammarScore: completion.grammarScore,
    });
  }
  return lessonSessionSchema.parse({
    ...session,
    currentStepIndex: session.currentStepIndex + 1,
  });
}

// Adaptation rule: a grammar item scored below this threshold at wrap-up
// resurfaces in the next session.
export const GRAMMAR_RESURFACE_THRESHOLD = 6;

export function poorGrammarItemsFrom(previous: LessonSession | null): string[] {
  if (!previous || previous.grammarScore === null) return [];
  if (previous.grammarScore >= GRAMMAR_RESURFACE_THRESHOLD) return [];
  const grammarStep = previous.steps.find((step) => step.kind === 'grammar-focus');
  return grammarStep && grammarStep.kind === 'grammar-focus' ? [grammarStep.grammarItemId] : [];
}
