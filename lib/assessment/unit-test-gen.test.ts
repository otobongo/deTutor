import { describe, expect, it } from 'vitest';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import type { Unit } from '@/lib/db/curriculum';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import {
  createGeminiClient,
  GeminiError,
  type GeminiCallLogEntry,
  type GeminiTransport,
} from '@/lib/gemini/client';
import {
  generateUnitTest,
  sectionPlan,
  sharedItems,
  validateUnitTest,
  type UnitTest,
} from './unit-test-gen';

const maybeUnit = seedUnits.find((candidate) => candidate.id === 'a1-4');
if (!maybeUnit) throw new Error('a1-4 missing');
const unit: Unit = maybeUnit;
const unitItems = seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id));
const plan = sectionPlan(unitItems);

function objective(stimulus: string, grammarItemId: string) {
  return {
    stimulus,
    question: `Frage zu ${stimulus}?`,
    options: ['a', 'b', 'c'],
    correctIndex: 0,
    grammarItemId,
  };
}

function fixtureTest(prefix: string): UnitTest {
  return {
    unitId: 'a1-4',
    listening: Array.from({ length: plan.listeningItems }, (_, i) =>
      objective(`${prefix}-hoeren-${i}`, 'noun-genders-articles'),
    ),
    reading: Array.from({ length: plan.readingItems }, (_, i) =>
      objective(`${prefix}-lesen-${i}`, 'plural-die'),
    ),
    writing: {
      instruction: 'Beschreibe dein Zimmer (drei Sätze).',
      contentPoints: ['Name three objects', 'Use der/die/das correctly', 'One plural'],
      grammarItemIds: ['noun-genders-articles'],
    },
    speaking: {
      instruction: 'Zeig deine Wohnung: nenne fünf Dinge mit Artikel.',
      contentPoints: ['Five nouns with articles', 'Room names'],
      grammarItemIds: ['noun-genders-articles', 'plural-die'],
    },
  };
}

function clientWith(responses: string[]) {
  const logs: GeminiCallLogEntry[] = [];
  const transport: GeminiTransport = {
    generate: () => {
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  const client = createGeminiClient(
    transport,
    { fast: 'fast-model', deep: 'deep-model' },
    (entry) => logs.push(entry),
  );
  return { client, logs };
}

const input = {
  unit,
  unitGrammarItems: unitItems,
  unitVocabulary: loadVocabSeedFile('A1').slice(0, 50),
  attempt: 1,
};

describe('unit test generator (GT-301)', () => {
  it('section counts follow the unit grammar weights proportionally', () => {
    // a1-4 carries noun-genders-articles (3x) and plural-die (1x): 8 items.
    expect(plan.listeningItems + plan.readingItems).toBe(8);
    const lightUnit = seedGrammarItems.filter((item) =>
      ['teen-numbers-pattern', 'weekdays-time'].includes(item.id),
    );
    const lightPlan = sectionPlan(lightUnit);
    expect(lightPlan.listeningItems + lightPlan.readingItems).toBeLessThan(
      plan.listeningItems + plan.readingItems,
    );
  });

  it('generates a valid test on the deep tier', async () => {
    const { client, logs } = clientWith([JSON.stringify(fixtureTest('t1'))]);
    const test = await generateUnitTest(client, input);
    expect(test.listening).toHaveLength(plan.listeningItems);
    expect(test.reading).toHaveLength(plan.readingItems);
    expect(logs[0]?.tier).toBe('deep');
    expect(logs[0]?.callSite).toBe('unit-test-generation');
  });

  it('rejects out-of-unit grammar items, retries once, then fails typed', async () => {
    const bad = fixtureTest('t1');
    const poisoned = {
      ...bad,
      listening: [{ ...bad.listening[0], grammarItemId: 'dativ-intro' }, ...bad.listening.slice(1)],
    };
    const raw = JSON.stringify(poisoned);
    const { client } = clientWith([raw, raw]);
    const failure = await generateUnitTest(client, input).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).message).toContain('out-of-unit');
  });

  it('validates section counts against the plan', () => {
    const short = fixtureTest('t1');
    const truncated = { ...short, reading: short.reading.slice(1) };
    const problems = validateUnitTest(truncated, unit, plan);
    expect(problems.some((problem) => problem.includes('reading has'))).toBe(true);
  });

  it('regeneration produces a different but equivalent test', async () => {
    const first = fixtureTest('t1');
    const second = fixtureTest('t2');
    expect(sharedItems(first, second)).toEqual([]);
    const { client } = clientWith([JSON.stringify(second)]);
    const regenerated = await generateUnitTest(client, { ...input, attempt: 2, avoid: first });
    expect(regenerated.listening).toHaveLength(first.listening.length);
    expect(sharedItems(first, regenerated)).toEqual([]);
  });

  it('refuses a regeneration that repeats previous items', async () => {
    const first = fixtureTest('t1');
    const raw = JSON.stringify(first);
    const { client } = clientWith([raw, raw]);
    const failure = await generateUnitTest(client, {
      ...input,
      attempt: 2,
      avoid: first,
    }).catch((error: unknown) => error);
    expect((failure as GeminiError).message).toContain('repeats items');
  });
});
