import { placementProbes } from '@/db/seed/placement-probes';
import { OnboardingWizard } from './components/onboarding-wizard';

// Onboarding entry (GT-107, slimmed 2026-07-10): welcome plus the placement
// ladder. Every preference starts at its default and lives in Settings.
// Probes pass to the client without their answer keys mattering: the ladder
// needs correctness for escalation; the server re-scores authoritatively.

export default function OnboardingPage() {
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
