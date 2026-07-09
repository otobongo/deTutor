import type { RetentionScore } from '@/lib/db/learner';
import type { InjectExtras, WarmupItem } from '@/lib/fsrs/queue';

// Spaced retests and retention (GT-304, GT-305). Passing a unit does not
// close it: retest items surface in warm-ups on the 7/14/30/60-day schedule,
// disguised as normal reviews, and their results move the unit's retention
// score only, never FSRS card states. All math here is pure and documented.

export const RETEST_SCHEDULE_DAYS = [7, 14, 30, 60] as const;

// Retention math: a unit starts at 80 on pass. A passed retest adds 10
// (capped 100); a failed retest subtracts 15; a lapsed schedule point (due
// but never taken before the next one arrived) subtracts 10. The threshold
// is a parameter so the difficulty engine can tighten it later.
export const INITIAL_RETENTION = 80;
export const RETEST_PASS_DELTA = 10;
export const RETEST_FAIL_DELTA = -15;
export const LAPSE_DELTA = -10;
export const DEFAULT_RETENTION_THRESHOLD = 60;

export function initialRetention(unitId: string): RetentionScore {
  return { unitId, score: INITIAL_RETENTION, lastRetestAt: null };
}

export interface PassedUnit {
  readonly unitId: string;
  readonly passedAt: string;
  readonly retention: RetentionScore;
}

function pointDate(passedAt: string, days: number): Date {
  return new Date(new Date(passedAt).getTime() + days * 86_400_000);
}

// A schedule point is due when its date has arrived and no retest has been
// taken at or after that date.
export function dueSchedulePoints(unit: PassedUnit, now: Date): number[] {
  return RETEST_SCHEDULE_DAYS.filter((days) => {
    const due = pointDate(unit.passedAt, days);
    if (due.getTime() > now.getTime()) return false;
    const last = unit.retention.lastRetestAt;
    return last === null || new Date(last).getTime() < due.getTime();
  });
}

export interface DueRetest {
  readonly retestId: string;
  readonly unitId: string;
  readonly schedulePointDays: number;
}

export function dueRetests(units: readonly PassedUnit[], now: Date): DueRetest[] {
  return units.flatMap((unit) => {
    const points = dueSchedulePoints(unit, now);
    // One disguised item per warm-up per unit: take the earliest due point.
    const point = points[0];
    return point === undefined
      ? []
      : [
          {
            retestId: `retest-${unit.unitId}-d${point}`,
            unitId: unit.unitId,
            schedulePointDays: point,
          },
        ];
  });
}

// The GT-105 seam: retest items ride the warm-up queue after the reviews,
// shaped exactly like every other WarmupItem (UI-indistinguishable).
export function makeRetestInjector(due: readonly DueRetest[]): InjectExtras {
  return (items: readonly WarmupItem[]) => [
    ...items,
    ...due.map((retest): WarmupItem => ({
      kind: 'retest',
      retestId: retest.retestId,
      unitId: retest.unitId,
    })),
  ];
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score));
}

// GT-305: silent scoring against the unit's retention record only.
export function applyRetestResult(
  retention: RetentionScore,
  correct: boolean,
  nowIso: string,
): RetentionScore {
  return {
    ...retention,
    score: clamp(retention.score + (correct ? RETEST_PASS_DELTA : RETEST_FAIL_DELTA)),
    lastRetestAt: nowIso,
  };
}

// Lapses: schedule points that came due and were superseded by a later due
// point without any retest. Applied when retention is loaded for planning.
export function applyLapses(unit: PassedUnit, now: Date): RetentionScore {
  const duePoints = dueSchedulePoints(unit, now);
  const missed = Math.max(0, duePoints.length - 1);
  if (missed === 0) return unit.retention;
  return { ...unit.retention, score: clamp(unit.retention.score + missed * LAPSE_DELTA) };
}

export function needsRemediation(
  retention: RetentionScore,
  threshold: number = DEFAULT_RETENTION_THRESHOLD,
): boolean {
  return retention.score < threshold;
}

// Decayed units resurface in the daily plan: their grammar items feed the
// lesson engine's resurfacing seam so tomorrow's grammar focus targets them.
export function decayedUnitIds(
  units: readonly PassedUnit[],
  now: Date,
  threshold: number = DEFAULT_RETENTION_THRESHOLD,
): string[] {
  return units
    .filter((unit) => needsRemediation(applyLapses(unit, now), threshold))
    .map((unit) => unit.unitId);
}
