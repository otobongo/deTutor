import { SKILLS, type Level, type Skill } from '@/lib/db/curriculum';
import type { LearnerProfile, RetentionScore } from '@/lib/db/learner';
import { PASS_THRESHOLD, passes } from './scoring';

// Level gate exams (GT-306): moving A1->A2 or A2->B1 requires a four-module
// exam with every module at 60+, AND a minimum average retention across the
// level's units. Both conditions, deterministically, with the failure report
// naming exactly what blocks.

export const MIN_AVERAGE_RETENTION = 70;

export interface LevelGateInput {
  readonly fromLevel: Exclude<Level, 'B1'>;
  readonly moduleScores: Readonly<Record<Skill, number>>;
  readonly levelUnitRetentions: readonly RetentionScore[];
}

export interface LevelGateResult {
  readonly passed: boolean;
  readonly toLevel: Level | null;
  // Weakest first, so remediation starts where it matters most.
  readonly blockingModules: readonly { skill: Skill; score: number }[];
  readonly averageRetention: number;
  readonly retentionBlocks: boolean;
}

export function evaluateLevelGate(input: LevelGateInput): LevelGateResult {
  const blockingModules = SKILLS.map((skill) => ({
    skill,
    score: input.moduleScores[skill],
  }))
    .filter((entry) => !passes(entry.score))
    .sort((a, b) => a.score - b.score);

  const averageRetention =
    input.levelUnitRetentions.length === 0
      ? 0
      : Math.round(
          input.levelUnitRetentions.reduce((sum, retention) => sum + retention.score, 0) /
            input.levelUnitRetentions.length,
        );
  const retentionBlocks = averageRetention < MIN_AVERAGE_RETENTION;

  const passed = blockingModules.length === 0 && !retentionBlocks;
  return {
    passed,
    toLevel: passed ? (input.fromLevel === 'A1' ? 'A2' : 'B1') : null,
    blockingModules,
    averageRetention,
    retentionBlocks,
  };
}

// A pass advances the profile to the next level's first unit; a failed gate
// changes nothing.
export function advanceProfile(profile: LearnerProfile, result: LevelGateResult): LearnerProfile {
  if (!result.passed || result.toLevel === null) {
    throw new Error('Only a passed gate advances the profile.');
  }
  return {
    ...profile,
    level: result.toLevel,
    unitId: `${result.toLevel.toLowerCase()}-1`,
  };
}

export function gateFailureReport(result: LevelGateResult): string {
  if (result.passed) return 'Gate passed.';
  const parts: string[] = [];
  if (result.blockingModules.length > 0) {
    parts.push(
      `Modules below ${PASS_THRESHOLD}: ${result.blockingModules
        .map((entry) => `${entry.skill} (${entry.score})`)
        .join(', ')}.`,
    );
  }
  if (result.retentionBlocks) {
    parts.push(
      `Average retention ${result.averageRetention} is below the ${MIN_AVERAGE_RETENTION} minimum; ` +
        'retests on decayed units come first.',
    );
  }
  return parts.join(' ');
}
