import { z } from 'zod';
import { skillScoreConverter, learnerPaths, type SkillScore } from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import type { Level } from '@/lib/db/curriculum';

// Reading task formats (GT-208), mirroring Goethe Lesen: richtig/falsch,
// multiple choice a/b/c, and statement-to-advertisement matching. Items are
// generated with answer keys, consistency-checked in code, and scored
// deterministically into SkillScore(reading).

export const READING_TASK_FORMATS = ['richtig-falsch', 'multiple-choice', 'matching'] as const;
export type ReadingTaskFormat = (typeof READING_TASK_FORMATS)[number];

export const richtigFalschTaskSchema = z.object({
  format: z.literal('richtig-falsch'),
  text: z.string().min(1),
  items: z.array(z.object({ statement: z.string().min(1), answer: z.boolean() })).min(1),
});

export const multipleChoiceTaskSchema = z.object({
  format: z.literal('multiple-choice'),
  text: z.string().min(1),
  items: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(3),
        correctIndex: z.number().int().min(0).max(2),
      }),
    )
    .min(1),
});

export const matchingTaskSchema = z.object({
  format: z.literal('matching'),
  advertisements: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
  statements: z
    .array(z.object({ statement: z.string().min(1), matchesAdId: z.string().min(1) }))
    .min(1),
});

export const readingTaskSchema = z.discriminatedUnion('format', [
  richtigFalschTaskSchema,
  multipleChoiceTaskSchema,
  matchingTaskSchema,
]);
export type ReadingTask = z.infer<typeof readingTaskSchema>;

// Answer-key consistency beyond the schema: matching keys must reference
// existing ads and never assign two statements the same ad (the UI forbids
// double assignment, so the key must too).
export function checkAnswerKeyConsistency(task: ReadingTask): string[] {
  if (task.format !== 'matching') return [];
  const problems: string[] = [];
  const adIds = new Set(task.advertisements.map((ad) => ad.id));
  if (adIds.size !== task.advertisements.length) problems.push('duplicate advertisement ids');
  const used = new Set<string>();
  for (const statement of task.statements) {
    if (!adIds.has(statement.matchesAdId)) {
      problems.push(`statement references unknown ad "${statement.matchesAdId}"`);
    }
    if (used.has(statement.matchesAdId)) {
      problems.push(`ad "${statement.matchesAdId}" assigned to two statements`);
    }
    used.add(statement.matchesAdId);
  }
  return problems;
}

export interface GenerateReadingTaskInput {
  readonly format: ReadingTaskFormat;
  readonly level: Level;
  readonly text: string;
  readonly itemCount: number;
}

export async function generateReadingTask(
  client: GeminiClient,
  input: GenerateReadingTaskInput,
): Promise<ReadingTask> {
  const shapeByFormat: Record<ReadingTaskFormat, string> = {
    'richtig-falsch':
      '{"format":"richtig-falsch","text":string,"items":[{"statement":string,"answer":boolean}]}',
    'multiple-choice':
      '{"format":"multiple-choice","text":string,"items":[{"question":string,"options":[3 strings],"correctIndex":0|1|2}]}',
    matching:
      '{"format":"matching","advertisements":[{"id":string,"text":string}],"statements":[{"statement":string,"matchesAdId":string}]}',
  };
  const prompt =
    `Create a ${input.level} Goethe Lesen task (${input.format}) with ${input.itemCount} items ` +
    `about this text:\n${input.text}\nReturn JSON: ${shapeByFormat[input.format]}. ` +
    'Every answer key must be verifiable from the text alone.';

  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const task = await client.generateJson([{ role: 'learner', text: prompt }], readingTaskSchema, {
      callSite: 'reading-generation',
    });
    problems = checkAnswerKeyConsistency(task);
    if (task.format !== input.format) problems.push(`format drifted to ${task.format}`);
    if (problems.length === 0) return task;
  }
  throw new GeminiError(
    'parse-failure',
    `Generated reading task failed consistency checks twice: ${problems.join('; ')}`,
  );
}

// Deterministic scoring. Matching answers are ad assignments per statement
// index; a duplicate assignment is invalid input and scores zero for both.
export type ReadingAnswers =
  | { format: 'richtig-falsch'; answers: readonly boolean[] }
  | { format: 'multiple-choice'; answers: readonly number[] }
  | { format: 'matching'; answers: readonly string[] };

export interface ReadingTaskScore {
  readonly correct: number;
  readonly total: number;
  readonly score: number;
}

export function scoreReadingTask(task: ReadingTask, submitted: ReadingAnswers): ReadingTaskScore {
  if (task.format !== submitted.format) {
    throw new Error(`Answer format ${submitted.format} does not match task ${task.format}.`);
  }
  let correct = 0;
  let total = 0;
  if (task.format === 'richtig-falsch' && submitted.format === 'richtig-falsch') {
    total = task.items.length;
    correct = task.items.filter((item, index) => submitted.answers[index] === item.answer).length;
  } else if (task.format === 'multiple-choice' && submitted.format === 'multiple-choice') {
    total = task.items.length;
    correct = task.items.filter(
      (item, index) => submitted.answers[index] === item.correctIndex,
    ).length;
  } else if (task.format === 'matching' && submitted.format === 'matching') {
    total = task.statements.length;
    const seen = new Map<string, number>();
    submitted.answers.forEach((adId) => seen.set(adId, (seen.get(adId) ?? 0) + 1));
    correct = task.statements.filter((statement, index) => {
      const answer = submitted.answers[index];
      return answer === statement.matchesAdId && seen.get(answer) === 1;
    }).length;
  }
  return { correct, total, score: total === 0 ? 0 : Math.round((100 * correct) / total) };
}

// Persistence edge: append the attempt to SkillScore(reading) for the unit.
export async function writeReadingScore(
  store: DocumentStore,
  unitId: string,
  score: number,
  nowIso: string,
): Promise<SkillScore> {
  const collectionPath = learnerPaths.skillScores();
  const docId = `${unitId}-reading`;
  const existingRaw = await store.collection(collectionPath).doc(docId).get();
  const attempts =
    existingRaw && Array.isArray(existingRaw.attempts)
      ? [...(existingRaw.attempts as SkillScore['attempts'])]
      : [];
  attempts.push({ score, at: nowIso });
  const skillScore: SkillScore = { unitId, skill: 'reading', score, attempts };
  await store
    .collection(collectionPath)
    .doc(docId)
    .set(skillScoreConverter.toFirestore(skillScore));
  return skillScore;
}
