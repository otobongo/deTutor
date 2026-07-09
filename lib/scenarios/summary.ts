import { writeGrammarError } from '@/lib/analytics/grammar-log';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';
import type { RecordedCorrection, ScenarioScore, ScenarioState } from './engine';

// Post-session summary (GT-218), per the fixed system-prompt format: a table
// of your version / correct version / rule, the total, and the single most
// important takeaway. Zero-error sessions congratulate without an empty
// table. Every correction flows to the grammar log.

export interface SummaryRow {
  readonly yourVersion: string;
  readonly correctVersion: string;
  readonly rule: string;
}

export interface ScenarioSummary {
  readonly rows: readonly SummaryRow[];
  readonly totalErrors: number;
  readonly takeaway: string;
  readonly congratulation: string | null;
}

export function buildScenarioSummary(state: ScenarioState, score: ScenarioScore): ScenarioSummary {
  const rows = state.corrections.map((correction): SummaryRow => ({
    yourVersion: correction.original,
    correctVersion: correction.better,
    rule: correction.reason,
  }));
  return {
    rows,
    totalErrors: rows.length,
    takeaway: score.takeaway,
    congratulation:
      rows.length === 0
        ? 'Fehlerfrei! Not one correction needed this time; that is genuinely rare.'
        : null,
  };
}

export function correctionLogEntry(
  correction: RecordedCorrection,
  nowIso: string,
): GrammarErrorLogEntry {
  return {
    category: correction.category,
    item: correction.item,
    context: `Scenario: "${correction.original}" -> "${correction.better}" (${correction.reason})`,
    at: nowIso,
  };
}

export async function logScenarioCorrections(
  store: DocumentStore,
  state: ScenarioState,
  nowIso: string,
): Promise<number> {
  for (const correction of state.corrections) {
    await writeGrammarError(store, correctionLogEntry(correction, nowIso));
  }
  return state.corrections.length;
}
