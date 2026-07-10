'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PlacementProbe } from '@/db/seed/placement-probes';
import { nextStage, type PlacementAnswer } from '@/lib/placement/engine';
import type { Level } from '@/lib/db/curriculum';
import { completeOnboarding, type OnboardingOutcome } from '../actions/onboarding';
import { ActionRow, Button } from './ui';
import { FocusHeading } from './focus-heading';

// Onboarding wizard (GT-107, slimmed 2026-07-10 by owner decision): defaults
// over forced choices. Voice, dialect, image style, and theme all start at
// sensible defaults and live in Settings; onboarding is a welcome plus the
// placement ladder, conducted in English.

type WizardStage = 'welcome' | 'placement' | 'result';

export function OnboardingWizard({ probes }: { probes: readonly PlacementProbe[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>('welcome');
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [outcome, setOutcome] = useState<OnboardingOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLevel: Level | null = useMemo(
    () => (stage === 'placement' ? nextStage(probes, answers) : null),
    [stage, probes, answers],
  );
  const currentProbe = useMemo(() => {
    if (!currentLevel) return null;
    const answered = new Set(answers.map((answer) => answer.probeId));
    return probes.find((probe) => probe.level === currentLevel && !answered.has(probe.id)) ?? null;
  }, [currentLevel, probes, answers]);

  async function finishPlacement(finalAnswers: PlacementAnswer[]): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeOnboarding({ answers: finalAnswers });
      setOutcome(result);
      setStage('result');
    } catch {
      setError('Something went wrong saving your placement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function answerProbe(answer: string): void {
    if (!currentProbe) return;
    const nextAnswers = [...answers, { probeId: currentProbe.id, answer }];
    setAnswers(nextAnswers);
    setTextAnswer('');
    if (nextStage(probes, nextAnswers) === null) {
      void finishPlacement(nextAnswers);
    }
  }

  if (stage === 'welcome') {
    return (
      <section className="flex flex-col gap-4">
        <FocusHeading data-testid="welcome-heading">Willkommen!</FocusHeading>
        <p className="max-w-prose">
          A five-minute placement check finds your starting point; then a 15-to-20-minute daily
          session builds your German from there. Your tutor starts with a warm voice and standard
          Hochdeutsch; you can change the voice, dialect, images, and appearance any time in
          Settings.
        </p>
        <ActionRow>
          <Button onClick={() => setStage('placement')} data-testid="onboarding-start">
            Start the placement check
          </Button>
        </ActionRow>
      </section>
    );
  }

  if (stage === 'placement' && currentProbe) {
    const stageAnswered = answers.filter((answer) =>
      probes.some((probe) => probe.id === answer.probeId && probe.level === currentLevel),
    ).length;
    return (
      <section className="flex flex-col gap-4">
        <FocusHeading key="placement">
          Placement check: {currentLevel} ({stageAnswered + 1} of 5)
        </FocusHeading>
        <p data-testid="probe-prompt" lang="de">
          {currentProbe.prompt}
        </p>
        {currentProbe.kind === 'multiple-choice' && currentProbe.options ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-start">
            {currentProbe.options.map((option) => (
              <Button
                key={option}
                variant="secondary"
                className="justify-start text-left"
                lang="de"
                onClick={() => answerProbe(option)}
                data-testid="probe-option"
              >
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              answerProbe(textAnswer);
            }}
          >
            <input
              className="min-h-11 rounded-md border bg-surface px-3 py-2"
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              aria-label="Your answer"
              data-testid="probe-text-input"
            />
            <Button type="submit" data-testid="probe-text-submit">
              Answer
            </Button>
          </form>
        )}
        {submitting ? <p role="status">Scoring your placement...</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    );
  }

  if (stage === 'result' && outcome) {
    return (
      <section className="flex flex-col gap-4">
        <FocusHeading key="result">Your starting point</FocusHeading>
        <p data-testid="placement-result">
          You are starting at {outcome.result.startingLevel}, unit{' '}
          {outcome.result.startingUnitId.toUpperCase()}.{' '}
          {outcome.result.startingLevel === 'A1'
            ? 'We will build your German from the ground up, starting with sounds and greetings.'
            : 'You already have a foundation, so we skip what you have demonstrated and start where the work begins.'}
        </p>
        <p className="text-sm text-ink-muted" data-testid="profile-summary">
          Tutor voice: warm (Mia), Hochdeutsch. Change these and the app&apos;s appearance in{' '}
          <Link className="underline" href="/settings">
            Settings
          </Link>
          .
        </p>
        <ActionRow>
          <Button onClick={() => router.push('/today')} data-testid="start-day-1">
            Start Day 1
          </Button>
        </ActionRow>
      </section>
    );
  }

  return <p role="status">Loading...</p>;
}
