import { SKILLS } from '@/lib/db/curriculum';
import {
  DEFAULT_LEARNER_ID,
  learnerPaths,
  learnerProfileConverter,
  skillScoreConverter,
  type LearnerProfile,
} from '@/lib/db/learner';
import type { SeedTarget } from '@/db/seed/seed-curriculum';
import type { PlacementResult } from './engine';

// Persistence edge for placement (GT-106): profile and baseline SkillScores,
// all under learners/{learnerId}, all through converters. Re-running the
// placement overwrites baselines cleanly because documents are keyed by
// stable ids.

export const PLACEMENT_UNIT_ID = 'placement';

export async function persistPlacement(
  db: SeedTarget,
  result: PlacementResult,
  existingProfile: LearnerProfile | null,
  nowIso: string,
  learnerId: string = DEFAULT_LEARNER_ID,
): Promise<LearnerProfile> {
  const profile: LearnerProfile = {
    level: result.startingLevel,
    unitId: result.startingUnitId,
    settings: existingProfile?.settings ?? {
      voice: 'warm-1',
      dialect: 'hochdeutsch',
      imageStyle: 'mixed',
    },
  };

  const [learnersCollection, learnerDocId] = ((): [string, string] => {
    const parts = learnerPaths.root(learnerId).split('/');
    return [parts[0] as string, parts[1] as string];
  })();
  await db
    .collection(learnersCollection)
    .doc(learnerDocId)
    .set(learnerProfileConverter.toFirestore(profile));

  const scores = db.collection(learnerPaths.skillScores(learnerId));
  for (const skill of SKILLS) {
    const baseline = result.skillBaselines[skill];
    if (baseline === undefined) continue;
    await scores.doc(`${PLACEMENT_UNIT_ID}-${skill}`).set(
      skillScoreConverter.toFirestore({
        unitId: PLACEMENT_UNIT_ID,
        skill,
        score: baseline,
        attempts: [{ score: baseline, at: nowIso }],
      }),
    );
  }
  return profile;
}
