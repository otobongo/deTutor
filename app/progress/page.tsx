import Link from 'next/link';
import { loadGrammarErrors } from '@/lib/analytics/grammar-log';
import {
  foundationProgressSchema,
  learnedWordSchema,
  learnerPaths,
  retentionScoreSchema,
  skillScoreSchema,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { loadSessionReports } from '@/lib/lesson/wrap-up';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { FOUNDATION_TOPICS } from '@/db/seed/foundations';
import { allLearnGroups } from '@/db/seed/learn-groups';
import { gradeFor } from '@/lib/learn/progress';
import { LevelDashboard } from '@/app/components/level-dashboard';
import { SessionReportList } from '@/app/components/session-report-list';

// Progress tab: session view (GT-308), level dashboard (GT-310), and the
// Learn measurement (owner-directed 2026-07-10): words and foundations
// learned, as a percentage with a grade.

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const store = getDataStore();
  const [reports, errors, rawScores, rawRetentions, rawLearned, rawFoundation, profile] =
    await Promise.all([
      loadSessionReports(store),
      loadGrammarErrors(store),
      store.list(learnerPaths.skillScores()),
      store.list(learnerPaths.retentionScores()),
      store.list(learnerPaths.learnedWords()),
      store.list(learnerPaths.foundationProgress()),
      loadLearnerProfile(store),
    ]);
  const skillScores = rawScores
    .map((data) => skillScoreSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const retentions = rawRetentions
    .map((data) => retentionScoreSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));

  const learnedIds = new Set(
    rawLearned
      .map((data) => learnedWordSchema.safeParse(data))
      .flatMap((parsed) => (parsed.success ? [parsed.data.wordId] : [])),
  );
  const groups = profile ? allLearnGroups(loadVocabSeedFile(profile.level)) : [];
  const totalWords = groups.reduce((sum, group) => sum + group.words.length, 0);
  const totalLearned = groups.reduce(
    (sum, group) => sum + group.words.filter((word) => learnedIds.has(word.id)).length,
    0,
  );
  const learnPercent = totalWords === 0 ? 0 : Math.round((100 * totalLearned) / totalWords);
  const foundationsMarked = rawFoundation
    .map((data) => foundationProgressSchema.safeParse(data))
    .filter((parsed) => parsed.success && parsed.data.marked).length;

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Progress</h1>
      <section aria-labelledby="learning-heading" className="flex flex-col gap-3">
        <h2 id="learning-heading" className="text-xl font-medium">
          Learning
        </h2>
        <p data-testid="learn-progress-summary">
          {totalLearned} of {totalWords} A1 words learned ({learnPercent}%, grade{' '}
          {gradeFor(learnPercent)}). Foundations marked: {foundationsMarked} of{' '}
          {FOUNDATION_TOPICS.length}.{' '}
          <Link className="underline" href="/learn">
            Continue in Learn.
          </Link>
        </p>
      </section>
      <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
        <h2 id="sessions-heading" className="text-xl font-medium">
          Sessions
        </h2>
        <SessionReportList reports={reports} errors={errors} />
      </section>
      <section aria-labelledby="dashboard-heading" className="flex flex-col gap-3">
        <h2 id="dashboard-heading" className="text-xl font-medium">
          Level dashboard
        </h2>
        <LevelDashboard
          skillScores={skillScores}
          retentions={retentions}
          errors={errors}
          now={new Date()}
        />
      </section>
    </main>
  );
}
