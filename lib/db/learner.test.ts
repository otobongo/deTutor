import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEARNER_ID,
  fsrsCardStateConverter,
  grammarErrorLogEntrySchema,
  learnerPaths,
  learnerProfileConverter,
  retentionScoreConverter,
  sessionReportConverter,
  skillScoreConverter,
  skillScoreSchema,
  weeklySummaryConverter,
  type FsrsCardState,
  type GrammarErrorLogEntry,
  type LearnerProfile,
  type RetentionScore,
  type SessionReport,
  type SkillScore,
  type WeeklySummary,
} from './learner';
import { fakeSnapshot } from './test-helpers';

const profile: LearnerProfile = {
  level: 'A1',
  unitId: 'a1-1',
  settings: { voice: 'warm-1', dialect: 'hochdeutsch', imageStyle: 'mixed' },
};

const card: FsrsCardState = {
  wordId: 'tisch',
  phase: 'learning',
  due: '2026-07-10T08:00:00.000Z',
  stability: 1.2,
  difficulty: 5.8,
  elapsedDays: 0,
  scheduledDays: 1,
  reps: 1,
  lapses: 0,
  learningSteps: 1,
  lastReview: '2026-07-09T08:00:00.000Z',
};

const skillScore: SkillScore = {
  unitId: 'a1-1',
  skill: 'listening',
  score: 72,
  attempts: [{ score: 72, at: '2026-07-09T08:00:00.000Z' }],
};

const retention: RetentionScore = {
  unitId: 'a1-1',
  score: 88,
  lastRetestAt: null,
  passedAt: null,
};

const grammarError: GrammarErrorLogEntry = {
  category: 'case',
  item: 'mich/mir',
  context: 'Kannst du mich helfen?',
  at: '2026-07-09T08:00:00.000Z',
};

const report: SessionReport = {
  sessionDate: '2026-07-09T08:00:00.000Z',
  wordsReviewed: 18,
  recallRate: 0.83,
  newWords: 12,
  imageIdAccuracy: 0.9,
  scenarioScore: 7,
  skillScores: { listening: 70 },
  errorsByCategory: { gender: 2, case: 1 },
  grammarItemPracticed: 'v2-questions',
};

const summary: WeeklySummary = {
  weekStart: '2026-07-06T00:00:00.000Z',
  levelProgressPercent: 12,
  topErrorPatterns: [
    { category: 'gender', item: 'die Woche', occurrences: 4, fix: 'Nouns in -e are mostly die.' },
  ],
  retentionCurve: [{ at: '2026-07-09T08:00:00.000Z', score: 88 }],
  streakDays: 4,
  nextWeekFocus: 'Akkusativ pronouns in scenarios',
};

describe('learner state converters (GT-004)', () => {
  it.each([
    ['LearnerProfile', learnerProfileConverter, profile],
    ['FsrsCardState', fsrsCardStateConverter, card],
    ['SkillScore', skillScoreConverter, skillScore],
    ['RetentionScore', retentionScoreConverter, retention],
    ['GrammarErrorLogEntry', grammarErrorLogEntrySchema, grammarError],
    ['SessionReport', sessionReportConverter, report],
    ['WeeklySummary', weeklySummaryConverter, summary],
    // The literal-union entity types make the any-typed it.each row safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as ReadonlyArray<[string, any, any]>)(
    'round-trip preserves every field: %s',
    (_name, converterOrSchema, entity) => {
      if ('toFirestore' in converterOrSchema) {
        const written = converterOrSchema.toFirestore(entity);
        expect(converterOrSchema.fromFirestore(fakeSnapshot(written))).toEqual(entity);
      } else {
        expect(converterOrSchema.parse(entity)).toEqual(entity);
      }
    },
  );

  it('rejects a grammar error with an unknown category at runtime and compile time', () => {
    const runtime = grammarErrorLogEntrySchema.safeParse({
      ...grammarError,
      category: 'vocabulary',
    });
    expect(runtime.success).toBe(false);

    const compileTimeChecked: GrammarErrorLogEntry = {
      ...grammarError,
      // @ts-expect-error unknown categories fail typecheck (closed union)
      category: 'vocabulary',
    };
    expect(compileTimeChecked.category).toBe('vocabulary');
  });

  it('resolves all learner state under learners/default', () => {
    expect(learnerPaths.root()).toBe('learners/default');
    for (const collection of [
      learnerPaths.cards(),
      learnerPaths.skillScores(),
      learnerPaths.retentionScores(),
      learnerPaths.grammarErrors(),
      learnerPaths.sessionReports(),
      learnerPaths.weeklySummaries(),
    ]) {
      expect(collection.startsWith(`learners/${DEFAULT_LEARNER_ID}/`)).toBe(true);
    }
  });

  it('keeps the v2.1 auth switch a learnerId change only', () => {
    expect(learnerPaths.cards('uid-123')).toBe('learners/uid-123/cards');
  });

  it('rejects SkillScore values outside 0 to 100', () => {
    expect(skillScoreSchema.safeParse({ ...skillScore, score: 101 }).success).toBe(false);
    expect(skillScoreSchema.safeParse({ ...skillScore, score: -1 }).success).toBe(false);
    expect(skillScoreSchema.safeParse({ ...skillScore, score: 0 }).success).toBe(true);
    expect(skillScoreSchema.safeParse({ ...skillScore, score: 100 }).success).toBe(true);
  });

  it('requires at least one attempt on a SkillScore', () => {
    expect(skillScoreSchema.safeParse({ ...skillScore, attempts: [] }).success).toBe(false);
  });
});
