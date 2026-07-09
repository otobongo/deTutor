import {
  grammarErrorLogEntrySchema,
  learnerPaths,
  type GrammarErrorCategory,
  type GrammarErrorLogEntry,
} from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';

// The grammar mistake log (GT-214). writeGrammarError is the single write
// path (Section 9 of the strategy): scenarios, writing, image-ID, and tiles
// all call it; ad-hoc writes elsewhere are defects. Analytics queries are
// pure functions over loaded entries so detection stays deterministic.

function entryId(entry: GrammarErrorLogEntry): string {
  // Stable, collision-resistant enough at one entry per learner action:
  // timestamp plus category plus a short content hash of item and context.
  let hash = 0x811c9dc5;
  for (const char of `${entry.item}|${entry.context}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${entry.at}-${entry.category}-${hash.toString(16)}`;
}

export async function writeGrammarError(
  store: DocumentStore,
  entry: GrammarErrorLogEntry,
): Promise<string> {
  const validated = grammarErrorLogEntrySchema.parse(entry);
  const id = entryId(validated);
  await store.collection(learnerPaths.grammarErrors()).doc(id).set(validated);
  return id;
}

export async function loadGrammarErrors(store: DocumentStore): Promise<GrammarErrorLogEntry[]> {
  const raw = await store.list(learnerPaths.grammarErrors());
  return raw
    .map((data) => grammarErrorLogEntrySchema.parse(data))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function errorsByCategory(
  entries: readonly GrammarErrorLogEntry[],
  category: GrammarErrorCategory,
): GrammarErrorLogEntry[] {
  return entries.filter((entry) => entry.category === category);
}

export function errorsByItem(
  entries: readonly GrammarErrorLogEntry[],
  item: string,
): GrammarErrorLogEntry[] {
  return entries.filter((entry) => entry.item === item);
}

export function errorsInWindow(
  entries: readonly GrammarErrorLogEntry[],
  from: Date,
  to: Date,
): GrammarErrorLogEntry[] {
  return entries.filter((entry) => {
    const at = new Date(entry.at).getTime();
    return at >= from.getTime() && at <= to.getTime();
  });
}

export interface RecurringPattern {
  readonly category: GrammarErrorCategory;
  readonly item: string;
  readonly occurrences: number;
}

export const RECURRING_THRESHOLD = 3;
export const RECURRING_WINDOW_DAYS = 14;

// Deterministic detection: same category plus item, RECURRING_THRESHOLD or
// more times inside the trailing window. Ordered worst-first.
export function detectRecurringPatterns(
  entries: readonly GrammarErrorLogEntry[],
  now: Date,
): RecurringPattern[] {
  const windowStart = new Date(now.getTime() - RECURRING_WINDOW_DAYS * 86_400_000);
  const windowed = errorsInWindow(entries, windowStart, now);
  const tallies = new Map<string, RecurringPattern>();
  for (const entry of windowed) {
    const key = `${entry.category}|${entry.item}`;
    const existing = tallies.get(key);
    tallies.set(key, {
      category: entry.category,
      item: entry.item,
      occurrences: (existing?.occurrences ?? 0) + 1,
    });
  }
  return [...tallies.values()]
    .filter((pattern) => pattern.occurrences >= RECURRING_THRESHOLD)
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences ||
        a.category.localeCompare(b.category) ||
        a.item.localeCompare(b.item),
    );
}
