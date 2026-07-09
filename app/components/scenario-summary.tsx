import type { ScenarioSummary } from '@/lib/scenarios/summary';

// Post-session summary view (GT-218): the fixed table format, or a genuine
// congratulation when there is nothing to correct (never an empty table).

export function ScenarioSummaryView({ summary }: { summary: ScenarioSummary }) {
  return (
    <section className="flex flex-col gap-4" data-testid="scenario-summary">
      <h2 className="text-xl font-medium">Scenario summary</h2>
      {summary.congratulation ? (
        <p data-testid="summary-congratulation">{summary.congratulation}</p>
      ) : (
        <>
          <table className="border-collapse text-sm" data-testid="summary-table">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Your version</th>
                <th className="border px-2 py-1 text-left">Correct version</th>
                <th className="border px-2 py-1 text-left">Rule</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row, index) => (
                <tr key={index} data-testid="summary-row">
                  <td className="border px-2 py-1">{row.yourVersion}</td>
                  <td className="border px-2 py-1">{row.correctVersion}</td>
                  <td className="border px-2 py-1">{row.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p data-testid="summary-total">Total errors: {summary.totalErrors}</p>
        </>
      )}
      <p data-testid="summary-takeaway">
        <span className="font-medium">Takeaway: </span>
        {summary.takeaway}
      </p>
    </section>
  );
}
