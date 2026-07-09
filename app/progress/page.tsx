import { loadGrammarErrors } from '@/lib/analytics/grammar-log';
import { getDataStore } from '@/lib/db/store';
import { loadSessionReports } from '@/lib/lesson/wrap-up';
import { SessionReportList } from '@/app/components/session-report-list';

// Progress tab, session view (GT-308). Weekly summary and the level
// dashboard join with GT-309/GT-310.

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const store = getDataStore();
  const [reports, errors] = await Promise.all([
    loadSessionReports(store),
    loadGrammarErrors(store),
  ]);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Progress</h1>
      <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
        <h2 id="sessions-heading" className="text-xl font-medium">
          Sessions
        </h2>
        <SessionReportList reports={reports} errors={errors} />
      </section>
    </main>
  );
}
