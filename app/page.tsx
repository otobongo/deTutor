import { redirect } from 'next/navigation';
import { placementProbes } from '@/db/seed/placement-probes';
import { learnerPaths, learnerProfileSchema } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { OnboardingWizard } from './components/onboarding-wizard';

// Onboarding entry (GT-107, slimmed 2026-07-10): welcome plus the placement
// ladder. Every preference starts at its default and lives in Settings.
// Probes pass to the client without their answer keys mattering: the ladder
// needs correctness for escalation; the server re-scores authoritatively.

// A learner who already placed should never be asked to place again, so this
// route sends them to their plan instead. Onboarding stays reachable at this
// URL only while no profile exists; re-running placement deliberately goes
// through Settings rather than by landing on the site root (GT-D4).
export const dynamic = 'force-dynamic';

async function hasLearnerProfile(): Promise<boolean> {
  const [collection, id] = learnerPaths.root().split('/') as [string, string];
  const raw = await getDataStore().collection(collection).doc(id).get();
  return raw !== null && learnerProfileSchema.safeParse(raw).success;
}

export default async function OnboardingPage() {
  if (await hasLearnerProfile()) {
    redirect('/today');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-4 sm:p-8">
      <h1 className="font-display text-3xl font-semibold">deTutor</h1>
      <p data-testid="onboarding-intro" className="max-w-prose text-ink-muted">
        Your German tutor takes you from zero to B1: listening, reading, writing, and speaking.
      </p>
      <OnboardingWizard probes={placementProbes} />
    </main>
  );
}
