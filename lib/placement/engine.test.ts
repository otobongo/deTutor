import { describe, expect, it } from 'vitest';
import { placementProbes } from '@/db/seed/placement-probes';
import type { Level } from '@/lib/db/curriculum';
import { isCorrect, nextStage, runPlacement, type PlacementAnswer } from './engine';
import { persistPlacement } from './persist';
import type { SeedTarget } from '@/db/seed/seed-curriculum';

// Build answer sets with a controlled number of correct answers per stage.
function stageAnswers(level: Level, correctCount: number): PlacementAnswer[] {
  const probes = placementProbes.filter((probe) => probe.level === level);
  return probes.map((probe, index) => ({
    probeId: probe.id,
    answer: index < correctCount ? (probe.correctAnswers[0] as string) : 'deliberately wrong',
  }));
}

describe('placement ladder (GT-106)', () => {
  it('has exactly five probes per stage', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) {
      expect(placementProbes.filter((probe) => probe.level === level)).toHaveLength(5);
    }
  });

  it('assigns A1.1 for 3/5 at A1 without escalation', () => {
    const answers = stageAnswers('A1', 3);
    expect(nextStage(placementProbes, answers)).toBeNull();
    const result = runPlacement(placementProbes, answers);
    expect(result.startingUnitId).toBe('a1-1');
    expect(result.stages).toHaveLength(1);
  });

  it('escalates at exactly 4 correct', () => {
    expect(nextStage(placementProbes, stageAnswers('A1', 4))).toBe('A2');
    expect(nextStage(placementProbes, stageAnswers('A1', 3))).toBeNull();
  });

  it('assigns an A2 start for 5/5 then 4/5 then 2/5', () => {
    const answers = [...stageAnswers('A1', 5), ...stageAnswers('A2', 4), ...stageAnswers('B1', 2)];
    const result = runPlacement(placementProbes, answers);
    expect(result.startingLevel).toBe('A2');
    expect(result.startingUnitId).toBe('a2-1');
    expect(result.stages.map((stage) => stage.passed)).toEqual([true, true, false]);
  });

  it('requires passing the B1 probes to start at B1', () => {
    const answers = [...stageAnswers('A1', 5), ...stageAnswers('A2', 5), ...stageAnswers('B1', 4)];
    expect(runPlacement(placementProbes, answers).startingUnitId).toBe('b1-1');
  });

  it('computes per-skill baselines over administered probes only', () => {
    const answers = stageAnswers('A1', 5);
    const result = runPlacement(placementProbes, answers);
    for (const value of Object.values(result.skillBaselines)) {
      expect(value).toBe(100);
    }
    const partial = runPlacement(placementProbes, stageAnswers('A1', 3));
    const values = Object.values(partial.skillBaselines);
    expect(values.some((value) => value < 100)).toBe(true);
  });

  it('accepts answers case- and whitespace-insensitively', () => {
    const probe = placementProbes.find((candidate) => candidate.id === 'a1-sein');
    expect(probe).toBeDefined();
    if (probe) {
      expect(isCorrect(probe, '  BIST ')).toBe(true);
      expect(isCorrect(probe, 'ist')).toBe(false);
    }
  });
});

describe('placement persistence (GT-106)', () => {
  function fakeDb() {
    const written = new Map<string, FirebaseFirestore.DocumentData>();
    const db: SeedTarget = {
      collection: (path: string) => ({
        doc: (id: string) => ({
          set: (data: FirebaseFirestore.DocumentData) => {
            written.set(`${path}/${id}`, data);
            return Promise.resolve();
          },
        }),
      }),
    };
    return { db, written };
  }

  it('re-running placement overwrites baselines cleanly', async () => {
    const { db, written } = fakeDb();
    const first = runPlacement(placementProbes, stageAnswers('A1', 3));
    await persistPlacement(db, first, null, '2026-07-09T08:00:00.000Z');
    const firstCount = written.size;

    const second = runPlacement(placementProbes, [
      ...stageAnswers('A1', 5),
      ...stageAnswers('A2', 4),
      ...stageAnswers('B1', 2),
    ]);
    await persistPlacement(db, second, null, '2026-07-10T08:00:00.000Z');
    expect(written.size).toBe(firstCount);

    const profile = written.get('learners/default');
    expect(profile?.unitId).toBe('a2-1');
    const writingScore = written.get('learners/default/skillScores/placement-writing');
    expect(writingScore?.attempts).toHaveLength(1);
  });

  it('keeps every write under the learners/default tree', async () => {
    const { db, written } = fakeDb();
    const result = runPlacement(placementProbes, stageAnswers('A1', 4));
    await persistPlacement(db, result, null, '2026-07-09T08:00:00.000Z');
    for (const key of written.keys()) {
      expect(key.startsWith('learners/default')).toBe(true);
    }
  });
});
