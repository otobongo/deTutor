export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Willkommen!</h1>
      <p className="text-lg" data-testid="onboarding-intro">
        Your German tutor takes you from zero to B1: listening, reading, writing, and speaking.
      </p>
      <p className="text-sm opacity-70">
        Onboarding (voice, dialect, placement check) arrives with GT-107. This screen is the Phase 0
        entry point.
      </p>
    </main>
  );
}
