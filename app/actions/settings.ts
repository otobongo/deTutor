'use server';

import { z } from 'zod';
import {
  dialectSchema,
  imageStylePreferenceSchema,
  learnerPaths,
  learnerProfileConverter,
  learnerProfileSchema,
  type LearnerProfile,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';

// Settings persistence (GT-204): preferences merge into the profile without
// touching level or unit; placement re-run stays a separate flow (GT-106).

const settingsInput = z.object({
  voice: z.string().min(1),
  dialect: dialectSchema,
  imageStyle: imageStylePreferenceSchema,
});

export async function loadProfile(): Promise<LearnerProfile | null> {
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const raw = await getDataStore().collection(learners).doc(learnerId).get();
  const parsed = raw ? learnerProfileSchema.safeParse(raw) : null;
  return parsed?.success ? parsed.data : null;
}

export async function updateSettings(rawInput: unknown): Promise<LearnerProfile> {
  const settings = settingsInput.parse(rawInput);
  const existing = await loadProfile();
  if (!existing) {
    throw new Error('No learner profile yet; complete onboarding before changing settings.');
  }
  const profile: LearnerProfile = { ...existing, settings };
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  await getDataStore()
    .collection(learners)
    .doc(learnerId)
    .set(learnerProfileConverter.toFirestore(profile));
  return profile;
}
