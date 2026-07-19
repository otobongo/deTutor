import Link from 'next/link';
import { getTodaySession } from '@/app/actions/lesson';
import type { SessionStep } from '@/lib/db/learner';
import { estimateSessionMinutes, estimateStepMinutes } from '@/lib/lesson/session-estimate';
import { ButtonLink, StatusChip } from '@/app/components/ui';

// The Day view (GT-107 landing target; the full shell arrives with GT-220).
// Composes today's plan from the profile; without a profile it points back
// to onboarding.

export const dynamic = 'force-dynamic';

// The plan speaks human names, never internal ids: the grammar item's
// display name comes from the payload, not the step's id.
//
// warmupCount is the payload's warmupItems length rather than the step's
// queueWordIds: due retests ride the warm-up disguised as reviews (GT-304),
// so they are cards the learner will actually answer. Counting the step
// alone would show a smaller number here than the summary panel does.
function describeStep(step: SessionStep, grammarItemName: string, warmupCount: number): string {
  switch (step.kind) {
    case 'warm-up':
      return warmupCount > 0
        ? `Warm-up: ${warmupCount} review cards`
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

  const warmupCount = payload.warmupItems.length;
  const totalMinutes = estimateSessionMinutes(payload.session.steps, warmupCount);
  const vocabStep = payload.session.steps.find((step) => step.kind === 'new-vocabulary');
  const skillStep = payload.session.steps.find((step) => step.kind === 'skill-practice');
  const newWordCount = vocabStep?.kind === 'new-vocabulary' ? vocabStep.wordIds.length : 0;

  const planCard = (
    <ol className="flex flex-col overflow-hidden rounded-lg border" data-testid="day-plan">
      {payload.session.steps.map((step, index) => (
        <li
          key={step.kind}
          className="flex items-center gap-4 border-b bg-surface p-4 last:border-b-0"
          data-testid={`step-${step.kind}`}
        >
          <span
            aria-hidden="true"
            className="flex size-7 flex-none items-center justify-center rounded-full bg-surface-2 font-mono text-xs text-ink-muted"
          >
            {index + 1}
          </span>
          <span className="flex-1 text-sm">
            {describeStep(step, payload.grammarItem.name, payload.warmupItems.length)}
          </span>
          <span className="flex-none font-mono text-xs tabular-nums text-ink-muted">
            {estimateStepMinutes(step, warmupCount)} min
          </span>
        </li>
      ))}
    </ol>
  );

  const startButton = (
    <ButtonLink
      variant="primary"
      className="w-full justify-center"
      href="/today/session"
      data-testid="start-session"
    >
      Start today&apos;s session
    </ButtonLink>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-4 sm:p-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Today</h1>
        <p className="text-ink-muted" data-testid="today-summary">
          Unit {payload.unit.id.toUpperCase()}: {payload.unit.theme}. Your daily plan, about{' '}
          {totalMinutes} minutes.
        </p>
      </div>
      {remediationNotice}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1">{planCard}</div>
        {/* The panel follows the plan down the page: the question it answers
            (what am I committing to) is the one asked before starting, so the
            answer and the action must stay together. */}
        <aside
          className="flex flex-col gap-4 rounded-lg border bg-surface p-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:w-80"
          data-testid="session-summary"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-2xl font-semibold tracking-tight">
              <span data-testid="session-minutes">{totalMinutes}</span> min
            </span>
            <span className="text-sm text-ink-muted">today&apos;s session</span>
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Review cards</dt>
              <dd className="font-mono tabular-nums">{warmupCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">New words</dt>
              <dd className="font-mono tabular-nums">{newWordCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Grammar focus</dt>
              <dd className="text-right">{payload.grammarItem.name}</dd>
            </div>
            {skillStep?.kind === 'skill-practice' ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Skill slot</dt>
                <dd className="capitalize">{skillStep.slot}</dd>
              </div>
            ) : null}
          </dl>

          {payload.decayedUnitIds.length > 0 ? (
            <StatusChip tone="neutral">Includes remediation</StatusChip>
          ) : null}

          {startButton}
          <p className="text-center text-xs text-ink-subtle">
            Estimates only. Nothing is timed, and you can stop between steps.
          </p>
        </aside>
      </div>
    </main>
  );
}
