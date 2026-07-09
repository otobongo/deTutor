import {
  learnerPaths,
  skillScoreConverter,
  skillScoreSchema,
  type SkillScore,
} from '@/lib/db/learner';
import type { Skill } from '@/lib/db/curriculum';
import type { DocumentStore } from '@/lib/db/store';
import type { UnitTest } from './unit-test-gen';

// Per-skill scoring and pass gates (GT-302), Goethe-derived: 0 to 100 per
// skill, 60 exactly passes. Pure functions only (Prime Directive 5);
// persistence sits at the edge and appends attempts, never overwrites.

export const PASS_THRESHOLD = 60;

export function scoreObjectiveSection(results: readonly boolean[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter(Boolean).length;
  return Math.round((100 * correct) / results.length) as number;
}

// Production sections (writing, speaking) arrive as a GT-213-style rubric
// result: error count and content-point coverage, capped and normalized.
export interface ProductionRubricResult {
  readonly errorCount: number;
  readonly contentPointsCovered: number;
  readonly contentPointsTotal: number;
}

export function scoreProductionSection(rubric: ProductionRubricResult): number {
  if (rubric.contentPointsTotal === 0) return 0;
  const contentScore = (60 * rubric.contentPointsCovered) / rubric.contentPointsTotal;
  // Language control: full 40 with zero errors, minus 8 per error, floor 0.
  const languageScore = Math.max(0, 40 - 8 * rubric.errorCount);
  return Math.round(Math.min(100, contentScore + languageScore));
}

export function passes(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

export interface UnitTestResults {
  readonly listening: readonly boolean[];
  readonly reading: readonly boolean[];
  readonly writing: ProductionRubricResult;
  readonly speaking: ProductionRubricResult;
}

export interface SkillOutcome {
  readonly skill: Skill;
  readonly score: number;
  readonly passed: boolean;
}

export function scoreUnitTest(test: UnitTest, results: UnitTestResults): SkillOutcome[] {
  if (
    results.listening.length !== test.listening.length ||
    results.reading.length !== test.reading.length
  ) {
    throw new Error('Result counts must match the test item counts exactly.');
  }
  const scores: Array<[Skill, number]> = [
    ['listening', scoreObjectiveSection(results.listening)],
    ['reading', scoreObjectiveSection(results.reading)],
    ['writing', scoreProductionSection(results.writing)],
    ['speaking', scoreProductionSection(results.speaking)],
  ];
  return scores.map(([skill, score]) => ({ skill, score, passed: passes(score) }));
}

// Persistence edge: attempts append, never overwrite (GT-302 acceptance).
export async function recordSkillScore(
  store: DocumentStore,
  unitId: string,
  skill: Skill,
  score: number,
  nowIso: string,
): Promise<SkillScore> {
  const docId = `${unitId}-${skill}`;
  const collectionPath = learnerPaths.skillScores();
  const existingRaw = await store.collection(collectionPath).doc(docId).get();
  const existing = existingRaw ? skillScoreSchema.safeParse(existingRaw) : null;
  const attempts = existing?.success ? [...existing.data.attempts] : [];
  attempts.push({ score, at: nowIso });
  const skillScore: SkillScore = { unitId, skill, score, attempts };
  await store
    .collection(collectionPath)
    .doc(docId)
    .set(skillScoreConverter.toFirestore(skillScore));
  return skillScore;
}
