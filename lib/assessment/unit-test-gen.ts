import { z } from 'zod';
import type { GrammarItem, Unit, VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';

// Unit test generator (GT-301). The brain writes items; code owns the
// envelope: per-skill sections proportional to what the unit taught, items
// referencing only unit-covered grammar, answer keys structurally valid.
// Deep tier via the unit-test-generation escalation site.

export const objectiveItemSchema = z.object({
  // Listening items carry the clip text (spoken via the adapter); reading
  // items carry the printed text.
  stimulus: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(3),
  correctIndex: z.number().int().min(0).max(2),
  grammarItemId: z.string().min(1),
});
export type ObjectiveItem = z.infer<typeof objectiveItemSchema>;

export const productionPromptSchema = z.object({
  instruction: z.string().min(1),
  contentPoints: z.array(z.string().min(1)).min(2).max(4),
  grammarItemIds: z.array(z.string().min(1)).min(1),
});
export type ProductionPrompt = z.infer<typeof productionPromptSchema>;

export const unitTestSchema = z.object({
  unitId: z.string().min(1),
  listening: z.array(objectiveItemSchema).min(1),
  reading: z.array(objectiveItemSchema).min(1),
  writing: productionPromptSchema,
  speaking: productionPromptSchema,
});
export type UnitTest = z.infer<typeof unitTestSchema>;

export interface SectionPlan {
  readonly listeningItems: number;
  readonly readingItems: number;
}

// Proportionality: heavier grammar (by summed PRD weights) earns more
// objective items, split evenly between listening and reading. Writing and
// speaking are always one production prompt each (Goethe-style).
export function sectionPlan(unitItems: readonly GrammarItem[]): SectionPlan {
  const weightSum = unitItems.reduce((sum, item) => sum + item.weight, 0);
  const objective = Math.max(6, 2 * weightSum);
  const listeningItems = Math.ceil(objective / 2);
  return { listeningItems, readingItems: objective - listeningItems };
}

export function validateUnitTest(test: UnitTest, unit: Unit, plan: SectionPlan): string[] {
  const problems: string[] = [];
  if (test.unitId !== unit.id) problems.push(`unitId drifted to ${test.unitId}`);
  const allowed = new Set(unit.grammarItemIds);
  const usedIds = [
    ...test.listening.map((item) => item.grammarItemId),
    ...test.reading.map((item) => item.grammarItemId),
    ...test.writing.grammarItemIds,
    ...test.speaking.grammarItemIds,
  ];
  for (const id of usedIds) {
    if (!allowed.has(id)) problems.push(`out-of-unit grammar item "${id}"`);
  }
  if (test.listening.length !== plan.listeningItems) {
    problems.push(
      `listening has ${test.listening.length} items, plan wants ${plan.listeningItems}`,
    );
  }
  if (test.reading.length !== plan.readingItems) {
    problems.push(`reading has ${test.reading.length} items, plan wants ${plan.readingItems}`);
  }
  return problems;
}

// Regeneration equivalence: same structure, different items. Used by the
// retake flow so a second attempt never repeats the first test verbatim.
export function sharedItems(a: UnitTest, b: UnitTest): string[] {
  const keyOf = (item: ObjectiveItem) => `${item.stimulus}|${item.question}`;
  const aKeys = new Set([...a.listening, ...a.reading].map(keyOf));
  return [...b.listening, ...b.reading].map(keyOf).filter((key) => aKeys.has(key));
}

export interface GenerateUnitTestInput {
  readonly unit: Unit;
  readonly unitGrammarItems: readonly GrammarItem[];
  readonly unitVocabulary: readonly VocabularyWord[];
  // Distinguishes attempts so regeneration produces different items.
  readonly attempt: number;
  readonly avoid?: UnitTest;
}

export async function generateUnitTest(
  client: GeminiClient,
  input: GenerateUnitTestInput,
): Promise<UnitTest> {
  const plan = sectionPlan(input.unitGrammarItems);
  const grammarList = input.unitGrammarItems.map((item) => `- ${item.id}: ${item.name}`).join('\n');
  const vocabSample = input.unitVocabulary
    .slice(0, 80)
    .map((word) => (word.article ? `${word.article} ${word.german}` : word.german))
    .join(', ');
  const avoidNote = input.avoid
    ? `Do NOT reuse any of these stimuli: ${[...input.avoid.listening, ...input.avoid.reading]
        .map((item) => item.stimulus)
        .join(' | ')}\n`
    : '';
  const prompt =
    `Generate unit test attempt ${input.attempt} for unit ${input.unit.id} ` +
    `(${input.unit.theme}, level ${input.unit.level}).\n` +
    `Grammar taught (use ONLY these ids for grammarItemId/grammarItemIds):\n${grammarList}\n` +
    `Vocabulary covered (stay within): ${vocabSample}\n${avoidNote}` +
    `Sections: listening ${plan.listeningItems} items (stimulus = short spoken German text), ` +
    `reading ${plan.readingItems} items (stimulus = short printed German text), ` +
    'writing one production prompt with 3 content points, speaking one production prompt.\n' +
    'Every objective item: 3 options, one correct, answerable from the stimulus alone.\n' +
    'Return JSON: {"unitId":string,"listening":[{"stimulus","question","options":[3],"correctIndex":0|1|2,"grammarItemId"}],' +
    '"reading":[same shape],"writing":{"instruction","contentPoints":[strings],"grammarItemIds":[strings]},' +
    '"speaking":{same shape as writing}}.';

  let problems: string[] = [];
  for (let tries = 0; tries < 2; tries += 1) {
    const test = await client.generateJson([{ role: 'learner', text: prompt }], unitTestSchema, {
      callSite: 'unit-test-generation',
    });
    problems = validateUnitTest(test, input.unit, plan);
    if (input.avoid && sharedItems(input.avoid, test).length > 0) {
      problems.push('regenerated test repeats items from the previous attempt');
    }
    if (problems.length === 0) return test;
  }
  throw new GeminiError(
    'parse-failure',
    `Generated unit test failed validation twice: ${problems.join('; ')}`,
  );
}
