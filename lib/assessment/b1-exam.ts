import { z } from 'zod';
import type { Skill } from '@/lib/db/curriculum';
import { objectiveItemSchema, productionPromptSchema } from './unit-test-gen';

// B1 exit simulation (GT-307): the full Goethe-Zertifikat B1 structure,
// assembled from the official model-set blueprint. Structure, timing, and
// normalization are code; item content is generated (deep tier) into this
// frame and validated against it.

export interface ExamPartSpec {
  readonly part: number;
  readonly items: number;
}

export interface ExamModuleSpec {
  readonly skill: Skill;
  readonly minutes: number;
  readonly parts: readonly ExamPartSpec[];
  readonly productionTasks: number;
}

// Per the Goethe B1 Durchführungsbestimmungen: Lesen 5 parts / 30 items /
// 65 min; Hören 4 parts / 30 items / 40 min; Schreiben 3 tasks / 60 min;
// Sprechen 3 parts / 15 min.
export const B1_EXAM_BLUEPRINT: readonly ExamModuleSpec[] = [
  {
    skill: 'reading',
    minutes: 65,
    parts: [
      { part: 1, items: 6 },
      { part: 2, items: 6 },
      { part: 3, items: 7 },
      { part: 4, items: 7 },
      { part: 5, items: 4 },
    ],
    productionTasks: 0,
  },
  {
    skill: 'listening',
    minutes: 40,
    parts: [
      { part: 1, items: 10 },
      { part: 2, items: 5 },
      { part: 3, items: 7 },
      { part: 4, items: 8 },
    ],
    productionTasks: 0,
  },
  { skill: 'writing', minutes: 60, parts: [], productionTasks: 3 },
  { skill: 'speaking', minutes: 15, parts: [], productionTasks: 3 },
];

export const examObjectivePartSchema = z.object({
  part: z.number().int().positive(),
  items: z.array(objectiveItemSchema).min(1),
});

export const examModuleSchema = z.object({
  skill: z.enum(['listening', 'reading', 'writing', 'speaking']),
  parts: z.array(examObjectivePartSchema),
  productionTasks: z.array(productionPromptSchema),
});
export type ExamModule = z.infer<typeof examModuleSchema>;

export function validateExamModule(module: ExamModule): string[] {
  const spec = B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === module.skill);
  if (!spec) return [`unknown module ${module.skill}`];
  const problems: string[] = [];
  if (module.parts.length !== spec.parts.length) {
    problems.push(
      `${module.skill}: ${module.parts.length} parts, blueprint wants ${spec.parts.length}`,
    );
  }
  for (const partSpec of spec.parts) {
    const part = module.parts.find((candidate) => candidate.part === partSpec.part);
    if (!part) {
      problems.push(`${module.skill}: part ${partSpec.part} missing`);
    } else if (part.items.length !== partSpec.items) {
      problems.push(
        `${module.skill} part ${partSpec.part}: ${part.items.length} items, blueprint wants ${partSpec.items}`,
      );
    }
  }
  if (module.productionTasks.length !== spec.productionTasks) {
    problems.push(
      `${module.skill}: ${module.productionTasks.length} production tasks, blueprint wants ${spec.productionTasks}`,
    );
  }
  return problems;
}

// Module timer: pure clock math the UI enforces.
export interface ModuleTimer {
  readonly remainingSeconds: number;
  readonly expired: boolean;
}

export function moduleTimer(skill: Skill, startedAtIso: string, now: Date): ModuleTimer {
  const spec = B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === skill);
  if (!spec) throw new Error(`Unknown module ${skill}.`);
  const elapsed = (now.getTime() - new Date(startedAtIso).getTime()) / 1000;
  const remaining = Math.max(0, Math.round(spec.minutes * 60 - elapsed));
  return { remainingSeconds: remaining, expired: remaining === 0 };
}

// Objective modules normalize raw correct counts to 100; production modules
// arrive as rubric scores already on the 0-100 scale (GT-302) and average.
export function normalizeObjectiveModule(skill: Skill, correct: number): number {
  const spec = B1_EXAM_BLUEPRINT.find((candidate) => candidate.skill === skill);
  if (!spec || spec.parts.length === 0) throw new Error(`${skill} is not an objective module.`);
  const total = spec.parts.reduce((sum, part) => sum + part.items, 0);
  if (correct < 0 || correct > total) throw new Error(`correct must be 0..${total}`);
  return Math.round((100 * correct) / total);
}

export function normalizeProductionModule(taskScores: readonly number[]): number {
  if (taskScores.length === 0) return 0;
  return Math.round(taskScores.reduce((sum, score) => sum + score, 0) / taskScores.length);
}
