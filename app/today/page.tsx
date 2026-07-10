import Link from 'next/link';
import { getTodaySession } from '@/app/actions/lesson';
import type { SessionStep } from '@/lib/db/learner';
import { ButtonLink } from '@/app/components/ui';

// The Day view (GT-107 landing target; the full shell arrives with GT-220).
// Composes today's plan from the profile; without a profile it points back
// to onboarding.

export const dynamic = 'force-dynamic';

// The plan speaks human names, never internal ids: the grammar item's
// display name comes from the payload, not the step's id.
function describeStep(step: SessionStep, grammarItemName: string): string {
  switch (step.kind) {
    case 'warm-up':
      return step.queueWordIds.length > 0
        ? `Warm-up: ${step.queueWordIds.length} review cards`
        : 'Warm-up: no cards due yet (day one)';
    case 'new-vocabulary':
      return `New vocabulary: ${step.wordIds.length} words (theme: ${step.theme})`;
    case 'grammar-focus':
      return `Grammar focus: ${grammarItemName}`;
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
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p>No learner profile yet. Complete onboarding first.</p>
        <Link className="text-ink underline" href="/">
          Go to onboarding
        </Link>
      </main>
    );
  }

  const remediationNotice =
    payload.decayedUnitIds.length > 0 ? (
      <p
        className="rounded-md border border-[var(--color-warning)] p-3 text-sm"
        role="status"
        data-testid="remediation-notice"
      >
        Retention slipped on {payload.decayedUnitIds.map((id) => id.toUpperCase()).join(', ')}:
        today&apos;s grammar focus revisits that material.
      </p>
    ) : null;

  const planCard = (
    <div className="flex flex-col gap-4 rounded-lg border bg-surface p-4 sm:p-6">
      <ol className="flex list-decimal flex-col gap-2 pl-6" data-testid="day-plan">
        {payload.session.steps.map((step) => (
          <li key={step.kind} data-testid={`step-${step.kind}`}>
            {describeStep(step, payload.grammarItem.name)}
          </li>
        ))}
      </ol>
    </div>
  );

  const startButton = (
    <ButtonLink variant="primary" href="/today/session" data-testid="start-session">
      Start today&apos;s session
    </ButtonLink>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-3xl font-semibold">Today</h1>
      <p data-testid="today-summary">
        Unit {payload.unit.id.toUpperCase()}: {payload.unit.theme}. Your daily plan, 15 to 20
        minutes.
      </p>
      {remediationNotice}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1">{planCard}</div>
        <aside className="flex flex-col gap-4 rounded-lg border bg-surface p-4 lg:w-72">
          <div>
            <h2 className="font-medium">Unit {payload.unit.id.toUpperCase()}</h2>
            <p className="text-sm text-ink-muted">{payload.unit.theme}</p>
          </div>
          {startButton}
        </aside>
      </div>
    </main>
  );
}
