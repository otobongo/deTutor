import { describe, expect, it } from 'vitest';
import type { LearnerProfile } from '@/lib/db/learner';
import { advanceProfile, evaluateLevelGate, gateFailureReport } from './level-gate';

const retention = (unitId: string, score: number) => ({
  unitId,
  score,
  lastRetestAt: null,
  passedAt: null,
});

const healthyRetentions = ['a1-1', 'a1-2', 'a1-3', 'a1-4', 'a1-5', 'a1-6'].map((unitId) =>
  retention(unitId, 80),
);

const profile: LearnerProfile = {
  level: 'A1',
  unitId: 'a1-6',
  settings: { voice: 'warm-1', dialect: 'hochdeutsch', imageStyle: 'mixed' },
};

describe('level gate exams (GT-306)', () => {
  it('all modules 60+ but low retention blocks progression', () => {
    const result = evaluateLevelGate({
      fromLevel: 'A1',
      moduleScores: { listening: 70, reading: 65, writing: 60, speaking: 72 },
      levelUnitRetentions: healthyRetentions.map((entry) => ({ ...entry, score: 55 })),
    });
    expect(result.passed).toBe(false);
    expect(result.blockingModules).toEqual([]);
    expect(result.retentionBlocks).toBe(true);
    expect(gateFailureReport(result)).toContain('retention');
  });

  it('one module at 55 blocks with that module named, weakest first', () => {
    const result = evaluateLevelGate({
      fromLevel: 'A1',
      moduleScores: { listening: 70, reading: 55, writing: 60, speaking: 58 },
      levelUnitRetentions: healthyRetentions,
    });
    expect(result.passed).toBe(false);
    expect(result.blockingModules).toEqual([
      { skill: 'reading', score: 55 },
      { skill: 'speaking', score: 58 },
    ]);
    expect(gateFailureReport(result)).toContain('reading (55)');
  });

  it('a pass advances the level and unlocks the next unit set', () => {
    const result = evaluateLevelGate({
      fromLevel: 'A1',
      moduleScores: { listening: 70, reading: 65, writing: 60, speaking: 72 },
      levelUnitRetentions: healthyRetentions,
    });
    expect(result.passed).toBe(true);
    expect(result.toLevel).toBe('A2');
    const advanced = advanceProfile(profile, result);
    expect(advanced.level).toBe('A2');
    expect(advanced.unitId).toBe('a2-1');
    expect(advanced.settings).toEqual(profile.settings);
  });

  it('A2 to B1 works and failed gates refuse to advance profiles', () => {
    const passing = evaluateLevelGate({
      fromLevel: 'A2',
      moduleScores: { listening: 60, reading: 60, writing: 60, speaking: 60 },
      levelUnitRetentions: healthyRetentions,
    });
    expect(passing.toLevel).toBe('B1');

    const failing = evaluateLevelGate({
      fromLevel: 'A2',
      moduleScores: { listening: 59, reading: 60, writing: 60, speaking: 60 },
      levelUnitRetentions: healthyRetentions,
    });
    expect(() => advanceProfile(profile, failing)).toThrow(/passed gate/);
  });
});
