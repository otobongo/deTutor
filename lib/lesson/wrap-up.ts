import {
  learnerPaths,
  sessionReportConverter,
  sessionReportSchema,
  type GrammarErrorCategory,
  type LessonSession,
  type SessionReport,
} from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';
import type { ReviewRating } from '@/lib/fsrs/scheduler';

// Session wrap-up (GT-219): builds and persists the per-session report the
// Phase 3 analytics read. Every number is traceable to stored inputs; an
// interrupted session never produces a partial report.

// Recall means the learner produced the answer without failing: again is a
// miss, hard/good/easy count as recalled (hard = recalled with effort).
export function recallRateFrom(ratings: readonly ReviewRating[]): number {
  if (ratings.length === 0) return 0;
  const recalled = ratings.filter((rating) => rating !== 'again').length;
  return recalled / ratings.length;
}

export interface WrapUpInputs {
  readonly session: LessonSession;
  readonly warmupRatings: readonly ReviewRating[];
  readonly newWordIds: readonly string[];
  readonly imageIdResults: readonly boolean[];
  readonly scenarioScore: number | null;
  readonly skillScores: Partial<Record<'listening' | 'reading' | 'writing' | 'speaking', number>>;
  readonly errorsByCategory: Partial<Record<GrammarErrorCategory, number>>;
}

export function buildSessionReport(inputs: WrapUpInputs): SessionReport {
  const grammarStep = inputs.session.steps.find((step) => step.kind === 'grammar-focus');
  return sessionReportSchema.parse({
    sessionDate: inputs.session.createdAt,
    wordsReviewed: inputs.warmupRatings.length,
    recallRate: recallRateFrom(inputs.warmupRatings),
    newWords: inputs.newWordIds.length,
    imageIdAccuracy:
      inputs.imageIdResults.length === 0
        ? null
        : inputs.imageIdResults.filter(Boolean).length / inputs.imageIdResults.length,
    scenarioScore: inputs.scenarioScore,
    skillScores: inputs.skillScores,
    errorsByCategory: inputs.errorsByCategory,
    grammarItemPracticed: grammarStep?.kind === 'grammar-focus' ? grammarStep.grammarItemId : null,
  });
}

export async function persistSessionReport(
  store: DocumentStore,
  session: LessonSession,
  report: SessionReport,
): Promise<void> {
  if (session.status !== 'completed') {
    throw new Error('An interrupted session produces no report; complete the session first.');
  }
  await store
    .collection(learnerPaths.sessionReports())
    .doc(session.id)
    .set(sessionReportConverter.toFirestore(report));
}

// Reporting hook for Phase 3 (GT-308/GT-309): reports come back validated
// and ordered by session date.
export async function loadSessionReports(store: DocumentStore): Promise<SessionReport[]> {
  const raw = await store.list(learnerPaths.sessionReports());
  return raw
    .map((data) => sessionReportSchema.parse(data))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
