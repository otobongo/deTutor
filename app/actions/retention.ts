'use server';

import { learnerPaths, retentionScoreConverter, retentionScoreSchema } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { applyRetestResult } from '@/lib/assessment/retention';

// Disguised retest scoring (GT-304/305): the learner rated what looked like
// a normal review card; the result silently moves the unit's retention
// score and stamps lastRetestAt so the schedule point closes. FSRS card
// states are never touched here.

export async function submitRetestResultAction(unitId: string, correct: boolean): Promise<void> {
  const doc = getDataStore().collection(learnerPaths.retentionScores()).doc(unitId);
  const raw = await doc.get();
  const parsed = raw ? retentionScoreSchema.safeParse(raw) : null;
  if (!parsed?.success) return;
  const next = applyRetestResult(parsed.data, correct, new Date().toISOString());
  await doc.set(
    retentionScoreConverter.toFirestore(
      retentionScoreSchema.parse({ ...next, passedAt: parsed.data.passedAt }),
    ),
  );
}
