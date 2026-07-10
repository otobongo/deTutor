import { describe, expect, it } from 'vitest';
import type { GrammarErrorLogEntry, SessionReport } from '@/lib/db/learner';
import {
  createGeminiClient,
  GeminiError,
  type GeminiCallLogEntry,
  type GeminiTransport,
} from '@/lib/gemini/client';
import { generateWeeklySummary, streakDays } from './weekly-summary';

const weekStart = new Date('2026-07-06T00:00:00.000Z');

function report(dayOffset: number, recallRate: number): SessionReport {
  return {
    sessionDate: new Date(weekStart.getTime() + dayOffset * 86_400_000).toISOString(),
    wordsReviewed: 10,
    recallRate,
    newWords: 12,
    imageIdAccuracy: null,
    scenarioScore: null,
    skillScores: {},
    errorsByCategory: {},
    grammarItemPracticed: null,
  };
}

function caseError(daysBeforeWeekEnd: number): GrammarErrorLogEntry {
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
  return {
    category: 'case',
    item: 'mich/mir',
    context: 'Kannst du mich helfen?',
    at: new Date(weekEnd.getTime() - daysBeforeWeekEnd * 86_400_000).toISOString(),
  };
}

function clientWith(responses: string[]) {
  const logs: GeminiCallLogEntry[] = [];
  const prompts: string[] = [];
  const transport: GeminiTransport = {
    generate: ({ messages }) => {
      prompts.push(messages[0]?.text ?? '');
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  const client = createGeminiClient(
    transport,
    { fast: 'fast-model', deep: 'deep-model' },
    (entry) => logs.push(entry),
  );
  return { client, logs, prompts };
}

const matchingAdvice = JSON.stringify({
  fixes: [{ category: 'case', item: 'mich/mir', fix: 'mir after helfen, always.' }],
  nextWeekFocus: 'Recall rose from 60% to 75%; now drill Dativ pronouns in scenarios.',
});

const input = {
  weekStart,
  unitsPassedInLevel: 2,
  thisWeekReports: [report(0, 0.7), report(1, 0.8)],
  priorWeekReports: [report(-7, 0.6)],
  errors: [caseError(1), caseError(2), caseError(3)],
  retentions: [
    { unitId: 'a1-1', score: 85, lastRetestAt: weekStart.toISOString(), passedAt: null },
  ],
};

describe('weekly summary generator (GT-309)', () => {
  it('reported patterns come from the detector, with generated fixes attached', async () => {
    const { client, logs } = clientWith([matchingAdvice]);
    const summary = await generateWeeklySummary(client, input);
    expect(summary.topErrorPatterns).toEqual([
      { category: 'case', item: 'mich/mir', occurrences: 3, fix: 'mir after helfen, always.' },
    ]);
    expect(summary.levelProgressPercent).toBe(33);
    expect(logs[0]?.tier).toBe('deep');
    expect(logs[0]?.callSite).toBe('weekly-summary');
  });

  it('the advice prompt frames growth against the previous week only', async () => {
    const { client, prompts } = clientWith([matchingAdvice]);
    await generateWeeklySummary(client, input);
    expect(prompts[0]).toContain('previous week recall 60%');
    expect(prompts[0]).toContain('this week 75%');
  });

  it('rejects advice that invents patterns the detector never found', async () => {
    const invented = JSON.stringify({
      fixes: [{ category: 'gender', item: 'die Woche', fix: 'x' }],
      nextWeekFocus: 'y',
    });
    const { client } = clientWith([invented, invented]);
    const failure = await generateWeeklySummary(client, input).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).message).toContain('detector');
  });

  it('a pattern-free week needs no model call and stays encouraging', async () => {
    const { client, logs } = clientWith([]);
    const summary = await generateWeeklySummary(client, { ...input, errors: [] });
    expect(summary.topErrorPatterns).toEqual([]);
    expect(summary.nextWeekFocus.length).toBeGreaterThan(0);
    expect(logs).toHaveLength(0);
  });

  it('computes the streak from consecutive session days', () => {
    const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
    const reports = [report(6, 0.8), report(5, 0.8), report(4, 0.8), report(2, 0.8)];
    expect(streakDays(reports, weekEnd)).toBe(3);
    expect(streakDays([], weekEnd)).toBe(0);
  });
});
