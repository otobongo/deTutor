'use server';

import { z } from 'zod';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import type { Skill } from '@/lib/db/curriculum';
import { skillSchema } from '@/lib/db/curriculum';
import { getDataStore } from '@/lib/db/store';
import {
  examModuleSchema,
  examResultSchema,
  normalizeObjectiveModule,
  normalizeProductionModule,
  type ExamModule,
  type ExamResult,
} from '@/lib/assessment/b1-exam';
import { buildPlaceholderExamModule, generateExamModule } from '@/lib/assessment/b1-exam-gen';
import { passes } from '@/lib/assessment/scoring';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';

// B1 exam actions (owner-directed 2026-07-10): content is generated on
// demand the first time a module opens, cached forever in the store, and
// falls back to the deterministic blueprint filler when the brain is
// unreachable (never cached, so real content still generates later).
// Results persist per module; all four at 60+ pass the simulation.

const EXAM_CONTENT_COLLECTION = 'b1ExamContent';
const EXAM_RESULTS_COLLECTION = 'learners/default/b1ExamResults';

export interface ExamModulePayload {
  readonly module: ExamModule;
  readonly source: 'gemini' | 'placeholder';
}

export async function getExamModuleAction(skill: Skill): Promise<ExamModulePayload> {
  const store = getDataStore();
  const doc = store.collection(EXAM_CONTENT_COLLECTION).doc(skill);
  const cached = await doc.get();
  if (cached) {
    const parsed = examModuleSchema.safeParse(cached);
    if (parsed.success) return { module: parsed.data, source: 'gemini' };
  }
  try {
    const generated = await generateExamModule(getGeminiClient(), skill);
    await doc.set(examModuleSchema.parse(generated));
    return { module: generated, source: 'gemini' };
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    return {
      module: buildPlaceholderExamModule(skill, cumulativeCorpus('B1')),
      source: 'placeholder',
    };
  }
}

const submissionSchema = z.union([
  z.object({ skill: skillSchema, kind: z.literal('objective'), correct: z.number().int().min(0) }),
  z.object({
    skill: skillSchema,
    kind: z.literal('production'),
    taskScores: z.array(z.number().min(0).max(100)).min(1),
  }),
]);

export async function submitExamModuleAction(rawInput: unknown): Promise<ExamResult> {
  const input = submissionSchema.parse(rawInput);
  const score =
    input.kind === 'objective'
      ? normalizeObjectiveModule(input.skill, input.correct)
      : normalizeProductionModule(input.taskScores);
  const result = examResultSchema.parse({
    skill: input.skill,
    score,
    passed: passes(score),
    at: new Date().toISOString(),
  });
  await getDataStore().collection(EXAM_RESULTS_COLLECTION).doc(input.skill).set(result);
  return result;
}

export async function loadExamResultsAction(): Promise<ExamResult[]> {
  const raw = await getDataStore().list(EXAM_RESULTS_COLLECTION);
  return raw
    .map((data) => examResultSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
}
