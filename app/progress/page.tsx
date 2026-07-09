import { loadGrammarErrors } from '@/lib/analytics/grammar-log';
import { learnerPaths, retentionScoreSchema, skillScoreSchema } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadSessionReports } from '@/lib/lesson/wrap-up';
import { LevelDashboard } from '@/app/components/level-dashboard';
import { SessionReportList } from '@/app/components/session-report-list';

// Progress tab: session view (GT-308) and level dashboard (GT-310).

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const store = getDataStore();
  const [reports, errors, rawScores, rawRetentions] = await Promise.all([
    loadSessionReports(store),
    loadGrammarErrors(store),
    store.list(learnerPaths.skillScores()),
    store.list(learnerPaths.retentionScores()),
  ]);
  const skillScores = rawScores
    .map((data) => skillScoreSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const retentions = rawRetentions
    .map((data) => retentionScoreSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Progress</h1>
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
