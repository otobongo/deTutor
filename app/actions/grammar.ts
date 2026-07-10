'use server';

import { grammarErrorLogEntrySchema } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { writeGrammarError } from '@/lib/analytics/grammar-log';

// Client exercises (tiles, dictation, image-ID) grade with pure functions and
// hand their log entries here; writeGrammarError stays the single write path
// (GT-214).

export async function logGrammarErrorsAction(rawEntries: readonly unknown[]): Promise<number> {
  const store = getDataStore();
  let written = 0;
  for (const raw of rawEntries) {
    const entry = grammarErrorLogEntrySchema.parse(raw);
    await writeGrammarError(store, entry);
    written += 1;
  }
  return written;
}
