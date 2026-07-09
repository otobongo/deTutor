import { z } from 'zod';
import {
  weeklySummarySchema,
  type GrammarErrorLogEntry,
  type RetentionScore,
  type SessionReport,
  type WeeklySummary,
} from '@/lib/db/learner';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import { detectRecurringPatterns, type RecurringPattern } from './grammar-log';

// Weekly summary generator (GT-309). The numbers are deterministic: patterns
// come from the GT-214 detector, the streak from report dates, the retention
// curve from stored scores. The deep-tier call writes only the fixes and the
// next-week focus, framed against the learner's own previous week.

export function streakDays(reports: readonly SessionReport[], weekEnd: Date): number {
  const dates = new Set(reports.map((report) => report.sessionDate.slice(0, 10)));
  let streak = 0;
  for (let offset = 0; ; offset += 1) {
    const day = new Date(weekEnd.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    if (dates.has(day)) streak += 1;
    else break;
  }
  return streak;
}

function averageRecall(reports: readonly SessionReport[]): number {
  if (reports.length === 0) return 0;
  return reports.reduce((sum, report) => sum + report.recallRate, 0) / reports.length;
}

const adviceSchema = z.object({
  fixes: z.array(
    z.object({
      category: z.string().min(1),
      item: z.string().min(1),
      fix: z.string().min(1),
    }),
  ),
  nextWeekFocus: z.string().min(1),
});

export interface WeeklySummaryInput {
  readonly weekStart: Date;
  readonly unitsPassedInLevel: number;
  readonly thisWeekReports: readonly SessionReport[];
  readonly priorWeekReports: readonly SessionReport[];
  readonly errors: readonly GrammarErrorLogEntry[];
  readonly retentions: readonly RetentionScore[];
}

export async function generateWeeklySummary(
  client: GeminiClient,
  input: WeeklySummaryInput,
): Promise<WeeklySummary> {
  const weekEnd = new Date(input.weekStart.getTime() + 6 * 86_400_000);
  const patterns: RecurringPattern[] = detectRecurringPatterns(input.errors, weekEnd).slice(0, 5);

  const thisRecall = Math.round(averageRecall(input.thisWeekReports) * 100);
  const priorRecall = Math.round(averageRecall(input.priorWeekReports) * 100);
  const prompt =
    'Write weekly coaching advice. Growth framing: compare the learner ONLY to their own ' +
    `previous week (previous week recall ${priorRecall}%, this week ${thisRecall}%; ` +
    `previous week ${input.priorWeekReports.length} sessions, this week ${input.thisWeekReports.length}).\n` +
    `Recurring error patterns (detector output, fix EXACTLY these, no others):\n${patterns
      .map((pattern) => `- ${pattern.category} | ${pattern.item} (${pattern.occurrences}x)`)
      .join('\n')}\n` +
    'Return JSON: {"fixes":[{"category":string,"item":string,"fix":string}] (one per pattern, ' +
    'same category and item verbatim),"nextWeekFocus":string (one sentence naming the trend vs ' +
    'last week and the next lever)}.';

  let advice: z.infer<typeof adviceSchema> | null = null;
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2 && patterns.length > 0; attempt += 1) {
    const candidate = await client.generateJson([{ role: 'learner', text: prompt }], adviceSchema, {
      callSite: 'weekly-summary',
    });
    problems = patterns
      .filter(
        (pattern) =>
          !candidate.fixes.some(
            (fix) => fix.category === pattern.category && fix.item === pattern.item,
          ),
      )
      .map((pattern) => `missing fix for detector pattern ${pattern.category}|${pattern.item}`);
    if (candidate.fixes.length !== patterns.length) {
      problems.push('fixes must map one-to-one onto detector patterns');
    }
    if (problems.length === 0) {
      advice = candidate;
      break;
    }
  }
  if (patterns.length > 0 && advice === null) {
    throw new GeminiError(
      'parse-failure',
      `Weekly advice failed to match detector output twice: ${problems.join('; ')}`,
    );
  }

  return weeklySummarySchema.parse({
    weekStart: input.weekStart.toISOString(),
    levelProgressPercent: Math.round((100 * input.unitsPassedInLevel) / 6),
    topErrorPatterns: patterns.map((pattern) => ({
      category: pattern.category,
      item: pattern.item,
      occurrences: pattern.occurrences,
      fix:
        advice?.fixes.find((fix) => fix.category === pattern.category && fix.item === pattern.item)
          ?.fix ?? 'Review this pattern in the next session.',
    })),
    retentionCurve: input.retentions.map((retention) => ({
      at: retention.lastRetestAt ?? input.weekStart.toISOString(),
      score: retention.score,
    })),
    streakDays: streakDays(input.thisWeekReports, weekEnd),
    nextWeekFocus:
      advice?.nextWeekFocus ?? 'Keep the daily rhythm; no recurring error patterns this week.',
  });
}
