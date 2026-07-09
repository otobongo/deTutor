import { placementProbes } from '@/db/seed/placement-probes';
import type { AudioAsset } from '@/lib/media';
import { OnboardingWizard } from './components/onboarding-wizard';
import { getVoiceOptions, getVoiceSample } from './actions/onboarding';

// Onboarding entry (GT-107). Order per PRD 4.1: voice selection with samples
// (through the media adapter), dialect, then the placement ladder. Probes
// pass to the client without their answer keys.

export default async function OnboardingPage() {
  const voices = await getVoiceOptions();
  const samples: Record<string, AudioAsset> = {};
  for (const voice of voices) {
    samples[voice.id] = await getVoiceSample(voice.id);
  }
  // Probes ship whole (single-learner v1, open by design): the client ladder
  // needs correctness for escalation; the server re-scores authoritatively.
  const clientProbes = placementProbes;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Willkommen!</h1>
      <p data-testid="onboarding-intro">
        Your German tutor takes you from zero to B1: listening, reading, writing, and speaking.
        Three quick steps and we start.
      </p>
      <OnboardingWizard voices={voices} samples={samples} probes={clientProbes} />
    </main>
  );
}
