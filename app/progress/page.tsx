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
import { ProgressBar, StatusChip } from '@/app/components/ui';

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
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-4 sm:p-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Progress</h1>
      {/* The headline figures lead rather than sitting inside a sentence:
          this is a page that gets scanned, not read (GT-D9). */}
      <section
        aria-labelledby="learning-heading"
        className="flex flex-col gap-4 rounded-lg border bg-surface p-5"
      >
        <h2 id="learning-heading" className="font-display text-xl font-semibold tracking-tight">
          Learning
        </h2>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex flex-col">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {totalLearned}
              <span className="text-ink-muted"> / {totalWords}</span>
            </span>
            <span className="text-sm text-ink-muted">A1 words learned</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {learnPercent}%
            </span>
            <span className="text-sm text-ink-muted">
              grade <StatusChip tone="accent">{gradeFor(learnPercent)}</StatusChip>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {foundationsMarked}
              <span className="text-ink-muted"> / {FOUNDATION_TOPICS.length}</span>
            </span>
            <span className="text-sm text-ink-muted">foundations marked</span>
          </div>
        </div>
        <ProgressBar percent={learnPercent} label="A1 vocabulary learned" />
        {/* Kept for the e2e assertion and for screen readers: the visual
            treatment above is a scan aid, not a replacement for the sentence. */}
        <p className="sr-only" data-testid="learn-progress-summary">
          {totalLearned} of {totalWords} A1 words learned ({learnPercent}%, grade{' '}
          {gradeFor(learnPercent)}). Foundations marked: {foundationsMarked} of{' '}
          {FOUNDATION_TOPICS.length}.
        </p>
        <Link className="text-sm text-ink underline" href="/learn">
          Continue in Learn
        </Link>
      </section>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
        <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
          <h2 id="sessions-heading" className="font-display text-xl font-semibold tracking-tight">
            Sessions
          </h2>
          <SessionReportList reports={reports} errors={errors} />
        </section>
        <section aria-labelledby="dashboard-heading" className="flex flex-col gap-3">
          <h2 id="dashboard-heading" className="font-display text-xl font-semibold tracking-tight">
            Level dashboard
          </h2>
          <LevelDashboard
            skillScores={skillScores}
            retentions={retentions}
            errors={errors}
            now={new Date()}
          />
        </section>
      </div>
    </main>
  );
}
