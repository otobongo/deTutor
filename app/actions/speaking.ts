'use server';

import { z } from 'zod';
import { getDataStore } from '@/lib/db/store';
import {
  assessEchoAttempt,
  moveOnLogEntry,
  startEchoLoop,
  type EchoLoopState,
} from '@/lib/exercises/speaking-echo';
import { writeGrammarError } from '@/lib/analytics/grammar-log';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';

// Speaking echo actions: the pure GT-215 loop plus persistence of the
// move-on log entry. Exact matches confirm without the brain, so the loop
// works offline for precise attempts; fuzzy assessment needs the brain and
// reports its absence honestly.

const echoSnapshotSchema = z.object({
  target: z.string().min(1),
  attempts: z.number().int().nonnegative(),
  status: z.enum(['awaiting-response', 'confirmed', 'moved-on']),
});
export type EchoSnapshot = z.infer<typeof echoSnapshotSchema>;

export type EchoAttemptOutcome =
  | { readonly ok: true; readonly state: EchoLoopState }
  | { readonly ok: false; readonly category: string; readonly attempts: number };

export async function echoAttemptAction(
  rawSnapshot: unknown,
  transcript: string,
): Promise<EchoAttemptOutcome> {
  const snapshot = echoSnapshotSchema.parse(rawSnapshot);
  const state: EchoLoopState = {
    ...startEchoLoop(snapshot.target),
    attempts: snapshot.attempts,
    status: snapshot.status,
  };
  try {
    const next = await assessEchoAttempt(getGeminiClient(), state, transcript);
    if (next.status === 'moved-on') {
      const entry = moveOnLogEntry(next, new Date().toISOString());
      if (entry) await writeGrammarError(getDataStore(), entry);
    }
    return { ok: true, state: next };
  } catch (error) {
    if (error instanceof GeminiError) {
      return { ok: false, category: error.category, attempts: snapshot.attempts };
    }
    throw error;
  }
}
