import { describe, expect, it } from 'vitest';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { lessonSessionConverter, type SkillSlot } from '@/lib/db/learner';
import { fakeSnapshot } from '@/lib/db/test-helpers';
import { introduceCard } from '@/lib/fsrs/scheduler';
import {
  completeStep,
  composeSession,
  currentStep,
  nextSkillSlot,
  poorGrammarItemsFrom,
  selectGrammarItem,
  type ComposeSessionInputs,
} from './engine';

const now = new Date('2026-07-09T08:00:00.000Z');
const maybeUnit = seedUnits.find((candidate) => candidate.id === 'a1-4');
if (!maybeUnit) throw new Error('seed unit a1-4 missing');
const unit = maybeUnit;
const unitItems = seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id));
const corpus = loadVocabSeedFile('A1');

function inputs(overrides: Partial<ComposeSessionInputs> = {}): ComposeSessionInputs {
  return {
    unit,
    unitGrammarItems: unitItems,
    corpus,
    learnedWordIds: new Set<string>(),
    cards: [introduceCard('nicht-adverb', now)],
    lastSkillSlot: null,
    poorGrammarItemIds: [],
    now,
    ...overrides,
  };
}

describe('daily lesson engine (GT-108)', () => {
  it('composes the five steps in the fixed order', () => {
    const session = composeSession(inputs());
    expect(session.steps.map((step) => step.kind)).toEqual([
      'warm-up',
      'new-vocabulary',
      'grammar-focus',
      'skill-practice',
      'wrap-up',
    ]);
    expect(session.unitId).toBe('a1-4');
    expect(session.status).toBe('active');
  });

  it('teaches exactly one grammar rule per session', () => {
    const session = composeSession(inputs());
    const grammarSteps = session.steps.filter((step) => step.kind === 'grammar-focus');
    expect(grammarSteps).toHaveLength(1);
    expect(unit.grammarItemIds).toContain(
      grammarSteps[0]?.kind === 'grammar-focus' ? grammarSteps[0].grammarItemId : '',
    );
  });

  it('resurfaces a poorly scored grammar item in the next session', () => {
    const first = composeSession(inputs());
    let session = first;
    for (let step = 0; step < 4; step += 1) {
      session = completeStep(session, { learnerProduced: true });
    }
    session = completeStep(session, { learnerProduced: true, grammarScore: 3 });
    expect(session.status).toBe('completed');

    const poor = poorGrammarItemsFrom(session);
    const grammarStep = first.steps.find((step) => step.kind === 'grammar-focus');
    expect(poor).toEqual([grammarStep?.kind === 'grammar-focus' ? grammarStep.grammarItemId : '']);

    const next = composeSession(
      inputs({ poorGrammarItemIds: poor, now: new Date('2026-07-10T08:00:00.000Z') }),
    );
    const nextGrammar = next.steps.find((step) => step.kind === 'grammar-focus');
    expect(nextGrammar).toEqual(grammarStep);
  });

  it('does not resurface a well-scored grammar item', () => {
    let session = composeSession(inputs());
    for (let step = 0; step < 4; step += 1) {
      session = completeStep(session, { learnerProduced: true });
    }
    session = completeStep(session, { learnerProduced: true, grammarScore: 8 });
    expect(poorGrammarItemsFrom(session)).toEqual([]);
  });

  it('resume restores the exact step and progress after a converter round-trip', () => {
    let session = composeSession(inputs());
    session = completeStep(session, { learnerProduced: true });
    session = completeStep(session, { learnerProduced: true });
    expect(currentStep(session).kind).toBe('grammar-focus');

    const persisted = lessonSessionConverter.toFirestore(session);
    const restored = lessonSessionConverter.fromFirestore(fakeSnapshot(persisted));
    expect(restored).toEqual(session);
    expect(currentStep(restored).kind).toBe('grammar-focus');
  });

  it('rotates the skill slot across all four skills in four sessions', () => {
    const slots: SkillSlot[] = [];
    let last: SkillSlot | null = null;
    for (let day = 0; day < 4; day += 1) {
      const slot = nextSkillSlot(last);
      slots.push(slot);
      last = slot;
    }
    expect(new Set(slots).size).toBe(4);
  });

  it('enforces chunk-then-produce: no content step advances without production', () => {
    const session = composeSession(inputs());
    expect(() => completeStep(session, { learnerProduced: false })).toThrow(/chunk-then-produce/);
  });

  it('requires the grammar score at wrap-up', () => {
    let session = composeSession(inputs());
    for (let step = 0; step < 4; step += 1) {
      session = completeStep(session, { learnerProduced: true });
    }
    expect(() => completeStep(session, { learnerProduced: true })).toThrow(/grammar score/);
  });

  it('builds the vocabulary step as a themed day-set of 10 to 15 words', () => {
    const session = composeSession(inputs());
    const vocabStep = session.steps.find((step) => step.kind === 'new-vocabulary');
    if (vocabStep?.kind !== 'new-vocabulary') throw new Error('missing vocab step');
    expect(vocabStep.wordIds.length).toBeGreaterThanOrEqual(10);
    expect(vocabStep.wordIds.length).toBeLessThanOrEqual(15);
    const wordsById = new Map(corpus.map((word) => [word.id, word]));
    const themes = new Set(vocabStep.wordIds.map((id) => wordsById.get(id)?.theme));
    expect(themes.size).toBe(1);
  });

  it('selects grammar items weight-proportionally over days', () => {
    const items = seedGrammarItems.filter((item) =>
      ['noun-genders-articles', 'plural-die'].includes(item.id),
    );
    const picks = new Map<string, number>();
    for (let day = 0; day < 40; day += 1) {
      const at = new Date(now.getTime() + day * 86_400_000);
      const pick = selectGrammarItem(items, [], at);
      picks.set(pick.id, (picks.get(pick.id) ?? 0) + 1);
    }
    const heavy = picks.get('noun-genders-articles') ?? 0;
    const light = picks.get('plural-die') ?? 0;
    expect(heavy).toBe(3 * light);
  });
});
