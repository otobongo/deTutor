import { describe, expect, it } from 'vitest';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';
import { hardAreaTrend, retentionHeat, skillTrajectories } from './dashboard';

const now = new Date('2026-07-28T00:00:00.000Z');

function genderError(daysAgo: number): GrammarErrorLogEntry {
  return {
    category: 'gender',
    item: 'die Woche',
    context: 'der Woche',
    at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

describe('level dashboard aggregates (GT-310)', () => {
  it('gender trend matches the log-derived weekly computation', () => {
    const errors = [
      genderError(1),
      genderError(2),
      genderError(9),
      genderError(10),
      genderError(11),
      genderError(23),
    ];
    const trend = hardAreaTrend(errors, 'gender', 4, now);
    expect(trend.map((week) => week.count)).toEqual([1, 0, 3, 2]);
  });

  it('retention heat reflects stored scores with banded severity', () => {
    const heat = retentionHeat([
      { unitId: 'a1-2', score: 55, lastRetestAt: null, passedAt: null },
      { unitId: 'a1-1', score: 88, lastRetestAt: null, passedAt: null },
      { unitId: 'a1-3', score: 65, lastRetestAt: null, passedAt: null },
    ]);
    expect(heat).toEqual([
      { unitId: 'a1-1', score: 88, band: 'healthy' },
      { unitId: 'a1-2', score: 55, band: 'decayed' },
      { unitId: 'a1-3', score: 65, band: 'warm' },
    ]);
  });

  it('skill trajectories order attempts chronologically per skill', () => {
    const trajectories = skillTrajectories([
      {
        unitId: 'a1-1',
        skill: 'writing',
        score: 72,
        attempts: [
          { score: 55, at: '2026-07-09T08:00:00.000Z' },
          { score: 72, at: '2026-07-12T08:00:00.000Z' },
        ],
      },
      {
        unitId: 'a1-2',
        skill: 'writing',
        score: 80,
        attempts: [{ score: 80, at: '2026-07-20T08:00:00.000Z' }],
      },
    ]);
    expect(trajectories.writing?.map((point) => point.score)).toEqual([55, 72, 80]);
  });
});
