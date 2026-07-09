import Link from 'next/link';
import { getTodaySession } from '@/app/actions/lesson';
import type { SessionStep } from '@/lib/db/learner';

// The Day view (GT-107 landing target; the full shell arrives with GT-220).
// Composes today's plan from the profile; without a profile it points back
// to onboarding.

export const dynamic = 'force-dynamic';

function describeStep(step: SessionStep): string {
  switch (step.kind) {
    case 'warm-up':
      return step.queueWordIds.length > 0
        ? `Warm-up: ${step.queueWordIds.length} review cards`
        : 'Warm-up: no cards due yet (day one)';
    case 'new-vocabulary':
      return `New vocabulary: ${step.wordIds.length} words (theme: ${step.theme})`;
    case 'grammar-focus':
      return `Grammar focus: ${step.grammarItemId}`;
    case 'skill-practice':
      return `Skill practice: ${step.slot}`;
    case 'wrap-up':
      return 'Wrap-up: scores and tomorrow preview';
  }
}

export default async function TodayPage() {
  const payload = await getTodaySession();

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p>No learner profile yet. Complete onboarding first.</p>
        <Link className="text-blue-700 underline" href="/">
          Go to onboarding
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Today</h1>
      <p data-testid="today-summary">
        Unit {payload.unit.id.toUpperCase()}: {payload.unit.theme}. Your daily plan, 15 to 20
        minutes.
      </p>
      {payload.decayedUnitIds.length > 0 ? (
        <p
          className="rounded border border-yellow-600 p-3 text-sm"
          role="status"
          data-testid="remediation-notice"
        >
          Retention slipped on {payload.decayedUnitIds.map((id) => id.toUpperCase()).join(', ')}:
          today&apos;s grammar focus revisits that material.
        </p>
      ) : null}
      <ol className="flex list-decimal flex-col gap-2 pl-6" data-testid="day-plan">
        {payload.session.steps.map((step) => (
          <li key={step.kind} data-testid={`step-${step.kind}`}>
            {describeStep(step)}
          </li>
        ))}
      </ol>
      <Link
        className="self-start rounded bg-blue-700 px-4 py-2 text-white"
        href="/today/session"
        data-testid="start-session"
      >
        Start today&apos;s session
      </Link>
    </main>
  );
}
