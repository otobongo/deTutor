import type { GrammarErrorCategory, RetentionScore, SkillScore } from '@/lib/db/learner';
import type { Skill } from '@/lib/db/curriculum';
import { errorsInWindow } from './grammar-log';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';

// Level dashboard aggregates (GT-310), all pure and log-derived. Hard-area
// trends count categorized errors per week bucket: a falling series is
// improving accuracy. Charts render from these aggregates verbatim.

export const HARD_AREAS: readonly GrammarErrorCategory[] = ['gender', 'case', 'ending', 'order'];

export interface TrajectoryPoint {
  readonly at: string;
  readonly score: number;
}

export function skillTrajectories(
  scores: readonly SkillScore[],
): Partial<Record<Skill, TrajectoryPoint[]>> {
  const bySkill: Partial<Record<Skill, TrajectoryPoint[]>> = {};
  for (const score of scores) {
    const points = (bySkill[score.skill] ??= []);
    for (const attempt of score.attempts) {
      points.push({ at: attempt.at, score: attempt.score });
    }
  }
  for (const points of Object.values(bySkill)) {
    points.sort((a, b) => a.at.localeCompare(b.at));
  }
  return bySkill;
}

export interface RetentionHeatCell {
  readonly unitId: string;
  readonly score: number;
  readonly band: 'healthy' | 'warm' | 'decayed';
}

export function retentionHeat(retentions: readonly RetentionScore[]): RetentionHeatCell[] {
  return [...retentions]
    .sort((a, b) => a.unitId.localeCompare(b.unitId))
    .map((retention) => ({
      unitId: retention.unitId,
      score: retention.score,
      band: retention.score >= 75 ? 'healthy' : retention.score >= 60 ? 'warm' : 'decayed',
    }));
}

export interface WeeklyErrorCount {
  readonly weekStart: string;
  readonly count: number;
}

// Errors per week for a category over the trailing weeks (oldest first).
// The chart reads improvement as a falling series.
export function hardAreaTrend(
  errors: readonly GrammarErrorLogEntry[],
  category: GrammarErrorCategory,
  weeks: number,
  now: Date,
): WeeklyErrorCount[] {
  const trend: WeeklyErrorCount[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const end = new Date(now.getTime() - index * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    const count = errorsInWindow(errors, start, end).filter(
      (entry) => entry.category === category,
    ).length;
    trend.push({ weekStart: start.toISOString().slice(0, 10), count });
  }
  return trend;
}

export function hardAreaTrends(
  errors: readonly GrammarErrorLogEntry[],
  weeks: number,
  now: Date,
): Record<(typeof HARD_AREAS)[number], WeeklyErrorCount[]> {
  return Object.fromEntries(
    HARD_AREAS.map((category) => [category, hardAreaTrend(errors, category, weeks, now)]),
  ) as Record<(typeof HARD_AREAS)[number], WeeklyErrorCount[]>;
}
