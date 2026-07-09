import type { GrammarErrorLogEntry, SessionReport } from '@/lib/db/learner';

// Session report view (GT-308). Honest presentation: every number renders
// verbatim from the stored report, drill-down lists the actual grammar-log
// entries for that day, and an empty day says so plainly.

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function SessionReportList({
  reports,
  errors,
}: {
  reports: readonly SessionReport[];
  errors: readonly GrammarErrorLogEntry[];
}) {
  if (reports.length === 0) {
    return (
      <p data-testid="reports-empty">
        No sessions recorded yet. Your first completed daily session will appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4" data-testid="session-reports">
      {[...reports].reverse().map((report) => {
        const dayErrors = errors.filter((entry) => sameDay(entry.at, report.sessionDate));
        return (
          <li
            key={report.sessionDate}
            className="rounded-lg border p-4"
            data-testid={`report-${report.sessionDate.slice(0, 10)}`}
          >
            <h3 className="font-medium">{report.sessionDate.slice(0, 10)}</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <dt>Words reviewed</dt>
              <dd data-testid="report-words-reviewed">{report.wordsReviewed}</dd>
              <dt>Recall rate</dt>
              <dd data-testid="report-recall">{Math.round(report.recallRate * 100)}%</dd>
              <dt>New words</dt>
              <dd data-testid="report-new-words">{report.newWords}</dd>
              <dt>Image-ID accuracy</dt>
              <dd data-testid="report-image-id">
                {report.imageIdAccuracy === null
                  ? 'no image exercises'
                  : `${Math.round(report.imageIdAccuracy * 100)}%`}
              </dd>
              <dt>Scenario score</dt>
              <dd data-testid="report-scenario">
                {report.scenarioScore === null ? 'no scenario' : `${report.scenarioScore} / 10`}
              </dd>
              <dt>Rule practiced</dt>
              <dd data-testid="report-grammar-item">{report.grammarItemPracticed ?? 'none'}</dd>
            </dl>
            {Object.keys(report.errorsByCategory).length > 0 ? (
              <p className="mt-2 text-sm" data-testid="report-error-categories">
                Errors:{' '}
                {Object.entries(report.errorsByCategory)
                  .map(([category, count]) => `${category} ${count}`)
                  .join(', ')}
              </p>
            ) : null}
            <details className="mt-2 text-sm">
              <summary data-testid="report-drilldown-toggle">
                Exact items ({dayErrors.length})
              </summary>
              {dayErrors.length === 0 ? (
                <p data-testid="drilldown-empty">No logged errors for this day.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 pl-4">
                  {dayErrors.map((entry, index) => (
                    <li key={index} data-testid="drilldown-item">
                      [{entry.category}] {entry.item}: {entry.context}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
