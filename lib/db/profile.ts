import { learnerProfileSchema, learnerPaths, type LearnerProfile } from '@/lib/db/learner';
import type { DocumentStore } from '@/lib/db/store';

// Shared profile read for server actions: the profile document is the root
// learner doc; a missing or invalid one means onboarding has not run.

export async function loadLearnerProfile(store: DocumentStore): Promise<LearnerProfile | null> {
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const raw = await store.collection(learners).doc(learnerId).get();
  const parsed = raw ? learnerProfileSchema.safeParse(raw) : null;
  return parsed?.success ? parsed.data : null;
}
