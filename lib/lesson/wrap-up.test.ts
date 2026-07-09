import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { DevFileStore } from '@/lib/db/store';
import { completeStep, composeSession } from './engine';
import {
  buildSessionReport,
  loadSessionReports,
  persistSessionReport,
  recallRateFrom,
} from './wrap-up';

const now = new Date('2026-07-09T08:00:00.000Z');
const maybeUnit = seedUnits.find((candidate) => candidate.id === 'a1-1');
if (!maybeUnit) throw new Error('a1-1 missing');
const unit = maybeUnit;

function session(completed: boolean) {
  let lessonSession = composeSession({
    unit,
    unitGrammarItems: seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id)),
    corpus: loadVocabSeedFile('A1'),
    learnedWordIds: new Set<string>(),
    cards: [],
    lastSkillSlot: null,
    poorGrammarItemIds: [],
    now,
  });
  if (completed) {
    for (let step = 0; step < 4; step += 1) {
      lessonSession = completeStep(lessonSession, { learnerProduced: true });
    }
    lessonSession = completeStep(lessonSession, { learnerProduced: true, grammarScore: 7 });
  }
  return lessonSession;
}

describe('session wrap-up (GT-219)', () => {
  it('recall rate math matches the queue rating results', () => {
    expect(recallRateFrom(['good', 'again', 'hard', 'easy'])).toBe(0.75);
    expect(recallRateFrom([])).toBe(0);
    expect(recallRateFrom(['again', 'again'])).toBe(0);
  });

  it('builds and persists a report carrying every PRD 4.7 field', async () => {
    const completed = session(true);
    const report = buildSessionReport({
      session: completed,
      warmupRatings: ['good', 'again', 'good', 'good'],
      newWordIds: ['a', 'b', 'c'],
      imageIdResults: [true, true, false],
      scenarioScore: 7,
      skillScores: { listening: 70 },
      errorsByCategory: { gender: 2 },
    });
    expect(report.wordsReviewed).toBe(4);
    expect(report.recallRate).toBe(0.75);
    expect(report.newWords).toBe(3);
    expect(report.imageIdAccuracy).toBeCloseTo(2 / 3);
    expect(report.scenarioScore).toBe(7);
    expect(report.grammarItemPracticed).not.toBeNull();

    const dir = mkdtempSync(path.join(tmpdir(), 'wrap-up-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await persistSessionReport(store, completed, report);
      const reports = await loadSessionReports(store);
      expect(reports).toEqual([report]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('an interrupted session produces no partial report', async () => {
    const active = session(false);
    const report = buildSessionReport({
      session: active,
      warmupRatings: [],
      newWordIds: [],
      imageIdResults: [],
      scenarioScore: null,
      skillScores: {},
      errorsByCategory: {},
    });
    const dir = mkdtempSync(path.join(tmpdir(), 'wrap-up-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await expect(persistSessionReport(store, active, report)).rejects.toThrow(/interrupted/i);
      expect(await loadSessionReports(store)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
