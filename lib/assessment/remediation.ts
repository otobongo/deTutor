import { z } from 'zod';
import type { Skill, Unit } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import { passes } from './scoring';
import type { ObjectiveItem, UnitTest } from './unit-test-gen';
import type { SkillOutcome } from './scoring';

// Remediation and single-skill retake (GT-303). Failing a skill locks its
// retake behind targeted remediation; passed skills are never touched. The
// progress state machine is pure; every transition is auditable.

export type RemediationStatus = 'pending' | 'done';

export interface UnitProgress {
  readonly unitId: string;
  readonly skills: Readonly<Record<Skill, { score: number; passed: boolean }>>;
  readonly remediation: Partial<Readonly<Record<Skill, RemediationStatus>>>;
}

export function startUnitProgress(unitId: string, outcomes: readonly SkillOutcome[]): UnitProgress {
  const skills = Object.fromEntries(
    outcomes.map((outcome) => [outcome.skill, { score: outcome.score, passed: outcome.passed }]),
  ) as UnitProgress['skills'];
  const remediation: Partial<Record<Skill, RemediationStatus>> = {};
  for (const outcome of outcomes) {
    if (!outcome.passed) remediation[outcome.skill] = 'pending';
  }
  return { unitId, skills, remediation };
}

export function completeRemediation(progress: UnitProgress, skill: Skill): UnitProgress {
  if (progress.remediation[skill] !== 'pending') {
    throw new Error(`No pending remediation for ${skill}.`);
  }
  return { ...progress, remediation: { ...progress.remediation, [skill]: 'done' } };
}

export function canRetake(progress: UnitProgress, skill: Skill): boolean {
  return !progress.skills[skill].passed && progress.remediation[skill] === 'done';
}

export function applyRetake(progress: UnitProgress, skill: Skill, newScore: number): UnitProgress {
  if (progress.skills[skill].passed) {
    throw new Error(`${skill} already passed; retakes cover only failed skills.`);
  }
  if (progress.remediation[skill] !== 'done') {
    throw new Error(`Retake of ${skill} is locked until its remediation completes.`);
  }
  return {
    ...progress,
    skills: {
      ...progress.skills,
      [skill]: { score: newScore, passed: passes(newScore) },
    },
  };
}

export function unitComplete(progress: UnitProgress): boolean {
  return Object.values(progress.skills).every((entry) => entry.passed);
}

// Targeted remediation generation: exercises must map to the grammar items
// of the actually failed items, checked in code.
export const remediationPlanSchema = z.object({
  exercises: z
    .array(
      z.object({
        grammarItemId: z.string().min(1),
        instruction: z.string().min(1),
        kind: z.enum(['drill', 'transform', 'produce']),
      }),
    )
    .min(1),
});
export type RemediationPlan = z.infer<typeof remediationPlanSchema>;

export function failedObjectiveItems(
  test: UnitTest,
  skill: 'listening' | 'reading',
  results: readonly boolean[],
): ObjectiveItem[] {
  const items = skill === 'listening' ? test.listening : test.reading;
  return items.filter((_, index) => results[index] === false);
}

export async function generateRemediation(
  client: GeminiClient,
  input: {
    readonly unit: Unit;
    readonly skill: Skill;
    readonly failedItems: readonly ObjectiveItem[];
  },
): Promise<RemediationPlan> {
  const failedIds = [...new Set(input.failedItems.map((item) => item.grammarItemId))];
  if (failedIds.length === 0) {
    throw new Error('Remediation needs at least one failed item to target.');
  }
  const prompt =
    `The learner failed the ${input.skill} section of unit ${input.unit.id}. ` +
    `Failed items:\n${input.failedItems
      .map((item) => `- [${item.grammarItemId}] ${item.question}`)
      .join('\n')}\n` +
    `Create 2 to 4 short targeted remediation exercises. Use ONLY these grammarItemIds: ${failedIds.join(', ')}.\n` +
    'Return JSON: {"exercises":[{"grammarItemId":string,"instruction":string,"kind":"drill"|"transform"|"produce"}]}.';

  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const plan = await client.generateJson(
      [{ role: 'learner', text: prompt }],
      remediationPlanSchema,
      { callSite: 'remediation-generation' },
    );
    problems = plan.exercises
      .filter((exercise) => !failedIds.includes(exercise.grammarItemId))
      .map((exercise) => `exercise targets untested item "${exercise.grammarItemId}"`);
    if (problems.length === 0) return plan;
  }
  throw new GeminiError(
    'parse-failure',
    `Remediation plan failed targeting checks twice: ${problems.join('; ')}`,
  );
}
