import { z } from 'zod';
import { zodConverter } from './converter';
import { levelSchema, skillSchema } from './curriculum';

// Learner state (GT-004). Single learner in v1; everything lives under
// learners/{learnerId} with learnerId "default" so the v2.1 auth switch is a
// learnerId-resolution change, not a data migration.

export const DEFAULT_LEARNER_ID = 'default';

export const DIALECTS = ['hochdeutsch', 'berlin'] as const;
export const dialectSchema = z.enum(DIALECTS);
export type Dialect = z.infer<typeof dialectSchema>;

export const IMAGE_STYLE_PREFERENCES = ['flat', 'render', 'mixed'] as const;
export const imageStylePreferenceSchema = z.enum(IMAGE_STYLE_PREFERENCES);
export type ImageStylePreference = z.infer<typeof imageStylePreferenceSchema>;

export const learnerProfileSchema = z.object({
  level: levelSchema,
  unitId: z.string().min(1),
  settings: z.object({
    voice: z.string().min(1),
    dialect: dialectSchema,
    imageStyle: imageStylePreferenceSchema,
  }),
});
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

// Timestamps are stored as ISO-8601 strings; GT-104 maps them to ts-fsrs Dates.
const isoDateTime = z.string().datetime();

export const FSRS_CARD_PHASES = ['new', 'learning', 'review', 'relearning'] as const;
export const fsrsCardPhaseSchema = z.enum(FSRS_CARD_PHASES);
export type FsrsCardPhase = z.infer<typeof fsrsCardPhaseSchema>;

export const fsrsCardStateSchema = z.object({
  wordId: z.string().min(1),
  phase: fsrsCardPhaseSchema,
  due: isoDateTime,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsedDays: z.number().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  learningSteps: z.number().int().nonnegative(),
  lastReview: isoDateTime.nullable(),
});
export type FsrsCardState = z.infer<typeof fsrsCardStateSchema>;

const scoreSchema = z.number().min(0).max(100);

export const skillScoreSchema = z.object({
  unitId: z.string().min(1),
  skill: skillSchema,
  score: scoreSchema,
  attempts: z
    .array(z.object({ score: scoreSchema, at: isoDateTime }))
    .min(1, 'a SkillScore exists only once an attempt exists'),
});
export type SkillScore = z.infer<typeof skillScoreSchema>;

export const retentionScoreSchema = z.object({
  unitId: z.string().min(1),
  score: scoreSchema,
  lastRetestAt: isoDateTime.nullable(),
  // When the unit test was passed; the retest schedule counts from here.
  // Nullable with a default so records written before 2026-07-10 still
  // parse (they simply never schedule retests).
  passedAt: isoDateTime.nullable().default(null),
});
export type RetentionScore = z.infer<typeof retentionScoreSchema>;

export const GRAMMAR_ERROR_CATEGORIES = [
  'gender',
  'case',
  'ending',
  'order',
  'spelling',
  'choice',
] as const;
export const grammarErrorCategorySchema = z.enum(GRAMMAR_ERROR_CATEGORIES);
export type GrammarErrorCategory = z.infer<typeof grammarErrorCategorySchema>;

export const grammarErrorLogEntrySchema = z.object({
  category: grammarErrorCategorySchema,
  item: z.string().min(1),
  context: z.string().min(1),
  at: isoDateTime,
});
export type GrammarErrorLogEntry = z.infer<typeof grammarErrorLogEntrySchema>;

export const sessionReportSchema = z.object({
  sessionDate: isoDateTime,
  wordsReviewed: z.number().int().nonnegative(),
  recallRate: z.number().min(0).max(1),
  newWords: z.number().int().nonnegative(),
  imageIdAccuracy: z.number().min(0).max(1).nullable(),
  scenarioScore: z.number().min(0).max(10).nullable(),
  skillScores: z.partialRecord(skillSchema, scoreSchema),
  errorsByCategory: z.partialRecord(grammarErrorCategorySchema, z.number().int().nonnegative()),
  grammarItemPracticed: z.string().min(1).nullable(),
});
export type SessionReport = z.infer<typeof sessionReportSchema>;

export const weeklySummarySchema = z.object({
  weekStart: isoDateTime,
  levelProgressPercent: z.number().min(0).max(100),
  topErrorPatterns: z
    .array(
      z.object({
        category: grammarErrorCategorySchema,
        item: z.string().min(1),
        occurrences: z.number().int().positive(),
        fix: z.string().min(1),
      }),
    )
    .max(5),
  retentionCurve: z.array(z.object({ at: isoDateTime, score: scoreSchema })),
  streakDays: z.number().int().nonnegative(),
  nextWeekFocus: z.string().min(1),
});
export type WeeklySummary = z.infer<typeof weeklySummarySchema>;

// Lesson session state (GT-108): persisted so an interrupted session resumes
// at its step. One document per session day.

export const SKILL_SLOTS = ['listening', 'reading', 'writing', 'scenario'] as const;
export const skillSlotSchema = z.enum(SKILL_SLOTS);
export type SkillSlot = z.infer<typeof skillSlotSchema>;

export const sessionStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('warm-up'), queueWordIds: z.array(z.string()) }),
  z.object({
    kind: z.literal('new-vocabulary'),
    theme: z.string().min(1),
    wordIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({ kind: z.literal('grammar-focus'), grammarItemId: z.string().min(1) }),
  z.object({ kind: z.literal('skill-practice'), slot: skillSlotSchema }),
  z.object({ kind: z.literal('wrap-up') }),
]);
export type SessionStep = z.infer<typeof sessionStepSchema>;

export const lessonSessionSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  createdAt: isoDateTime,
  currentStepIndex: z.number().int().min(0).max(4),
  steps: z.array(sessionStepSchema).length(5),
  status: z.enum(['active', 'completed']),
  // 0 to 10 self-consistency score for the practiced grammar item, written at
  // wrap-up; drives next-session resurfacing (GT-108 adaptation rule).
  grammarScore: z.number().min(0).max(10).nullable(),
});
export type LessonSession = z.infer<typeof lessonSessionSchema>;

// Unit progress (GT-401 flow wiring): per-unit skill outcomes and
// remediation gates from the GT-303 state machine, persisted per unit.
export const unitProgressSchema = z.object({
  unitId: z.string().min(1),
  skills: z.record(
    skillSchema,
    z.object({ score: z.number().min(0).max(100), passed: z.boolean() }),
  ),
  remediation: z.partialRecord(skillSchema, z.enum(['pending', 'done'])),
});
export type UnitProgressDoc = z.infer<typeof unitProgressSchema>;

// Learn-before-testing progress (owner-directed 2026-07-10). A learned word
// is a learner declaration made after reading, reciting, and understanding
// it in context; foundation topics additionally carry their best self-check
// score. Nothing gates on either; both are measured and graded.
export const learnedWordSchema = z.object({
  wordId: z.string().min(1),
  learnedAt: isoDateTime,
});
export type LearnedWord = z.infer<typeof learnedWordSchema>;

export const foundationProgressSchema = z.object({
  topicId: z.string().min(1),
  marked: z.boolean(),
  bestScore: z.number().min(0).max(100).nullable(),
  attempts: z.number().int().nonnegative(),
  updatedAt: isoDateTime,
});
export type FoundationProgress = z.infer<typeof foundationProgressSchema>;

// Every learner document lives under this tree; there is no learner data
// anywhere else (GT-004 acceptance criteria).
export const learnerPaths = {
  root: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}`,
  cards: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/cards`,
  skillScores: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/skillScores`,
  retentionScores: (learnerId: string = DEFAULT_LEARNER_ID) =>
    `learners/${learnerId}/retentionScores`,
  grammarErrors: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/grammarErrors`,
  sessionReports: (learnerId: string = DEFAULT_LEARNER_ID) =>
    `learners/${learnerId}/sessionReports`,
  weeklySummaries: (learnerId: string = DEFAULT_LEARNER_ID) =>
    `learners/${learnerId}/weeklySummaries`,
  sessions: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/sessions`,
  unitProgress: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/unitProgress`,
  learnedWords: (learnerId: string = DEFAULT_LEARNER_ID) => `learners/${learnerId}/learnedWords`,
  foundationProgress: (learnerId: string = DEFAULT_LEARNER_ID) =>
    `learners/${learnerId}/foundationProgress`,
} as const;

export const learnerProfileConverter = zodConverter(learnerProfileSchema);
export const fsrsCardStateConverter = zodConverter(fsrsCardStateSchema);
export const skillScoreConverter = zodConverter(skillScoreSchema);
export const retentionScoreConverter = zodConverter(retentionScoreSchema);
export const grammarErrorLogEntryConverter = zodConverter(grammarErrorLogEntrySchema);
export const sessionReportConverter = zodConverter(sessionReportSchema);
export const weeklySummaryConverter = zodConverter(weeklySummarySchema);
export const lessonSessionConverter = zodConverter(lessonSessionSchema);
export const unitProgressConverter = zodConverter(unitProgressSchema);
export const learnedWordConverter = zodConverter(learnedWordSchema);
export const foundationProgressConverter = zodConverter(foundationProgressSchema);
