'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlacementProbe } from '@/db/seed/placement-probes';
import type { Dialect } from '@/lib/db/learner';
import type { AudioAsset } from '@/lib/media/provider';
import { nextStage, type PlacementAnswer } from '@/lib/placement/engine';
import type { Level } from '@/lib/db/curriculum';
import {
  completeOnboarding,
  type OnboardingOutcome,
  type VoiceOption,
} from '../actions/onboarding';
import { AudioPlayer } from './audio-player';

// Onboarding wizard (GT-107): voice, then dialect, then the placement ladder,
// in that order (PRD 4.1). Conducted in English. Selections are changeable
// later in Settings (GT-204).

type WizardStage = 'voice' | 'dialect' | 'placement' | 'result';

export function OnboardingWizard({
  voices,
  samples,
  probes,
}: {
  voices: readonly VoiceOption[];
  samples: Readonly<Record<string, AudioAsset>>;
  probes: readonly PlacementProbe[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>('voice');
  const [voice, setVoice] = useState<string | null>(null);
  const [dialect, setDialect] = useState<Dialect | null>(null);
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
      const result = await completeOnboarding({
        voice: voice ?? 'warm-1',
        dialect: dialect ?? 'hochdeutsch',
        answers: finalAnswers,
      });
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

  if (stage === 'voice') {
    return (
      <section className="flex flex-col gap-4" aria-labelledby="voice-heading">
        <h2 id="voice-heading" className="text-xl font-medium">
          Choose your tutor&apos;s voice
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {voices.map((option) => {
            const sample = samples[option.id];
            return (
              <div
                key={option.id}
                className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 ${
                  voice === option.id
                    ? 'border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]'
                    : ''
                }`}
              >
                <p className="font-medium">
                  {option.name} <span className="text-sm text-ink-muted">({option.group})</span>
                </p>
                {sample ? <AudioPlayer asset={sample} label="Play sample" /> : null}
                <button
                  type="button"
                  className="rounded-md bg-action px-3 py-1 text-sm text-action-inverse"
                  onClick={() => setVoice(option.id)}
                  data-testid={`choose-voice-${option.id}`}
                >
                  Choose {option.name}
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
          disabled={voice === null}
          onClick={() => setStage('dialect')}
          data-testid="voice-continue"
        >
          Continue
        </button>
      </section>
    );
  }

  if (stage === 'dialect') {
    return (
      <section className="flex flex-col gap-4" aria-labelledby="dialect-heading">
        <h2 id="dialect-heading" className="text-xl font-medium">
          Dialect preference
        </h2>
        <p className="text-sm text-ink-muted">
          Standard Hochdeutsch is the default. Berlin mode adds labeled Berlin expressions.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className={`rounded-md border bg-surface px-4 py-2 ${dialect === 'hochdeutsch' ? 'border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]' : ''}`}
            onClick={() => setDialect('hochdeutsch')}
            data-testid="dialect-hochdeutsch"
          >
            Hochdeutsch
          </button>
          <button
            type="button"
            className={`rounded-md border bg-surface px-4 py-2 ${dialect === 'berlin' ? 'border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]' : ''}`}
            onClick={() => setDialect('berlin')}
            data-testid="dialect-berlin"
          >
            Berlin dialect mode
          </button>
        </div>
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
          onClick={() => setStage('placement')}
          data-testid="dialect-continue"
        >
          {dialect === null ? 'Skip (use Hochdeutsch)' : 'Continue'}
        </button>
      </section>
    );
  }

  if (stage === 'placement' && currentProbe) {
    const stageAnswered = answers.filter((answer) =>
      probes.some((probe) => probe.id === answer.probeId && probe.level === currentLevel),
    ).length;
    return (
      <section className="flex flex-col gap-4" aria-labelledby="placement-heading">
        <h2 id="placement-heading" className="text-xl font-medium">
          Placement check: {currentLevel} ({stageAnswered + 1} of 5)
        </h2>
        <p data-testid="probe-prompt">{currentProbe.prompt}</p>
        {currentProbe.kind === 'multiple-choice' && currentProbe.options ? (
          <div className="flex flex-col items-start gap-2">
            {currentProbe.options.map((option) => (
              <button
                key={option}
                type="button"
                className="rounded-md border bg-surface px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => answerProbe(option)}
                data-testid="probe-option"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              answerProbe(textAnswer);
            }}
          >
            <input
              className="rounded-md border bg-surface px-3 py-2"
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              aria-label="Your answer"
              data-testid="probe-text-input"
            />
            <button
              type="submit"
              className="rounded-md bg-action px-4 py-2 text-action-inverse"
              data-testid="probe-text-submit"
            >
              Answer
            </button>
          </form>
        )}
        {submitting ? <p>Scoring your placement...</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    );
  }

  if (stage === 'result' && outcome) {
    return (
      <section className="flex flex-col gap-4" aria-labelledby="result-heading">
        <h2 id="result-heading" className="text-xl font-medium">
          Your starting point
        </h2>
        <p data-testid="placement-result">
          You are starting at {outcome.result.startingLevel}, unit{' '}
          {outcome.result.startingUnitId.toUpperCase()}.{' '}
          {outcome.result.startingLevel === 'A1'
            ? 'We will build your German from the ground up, starting with sounds and greetings.'
            : 'You already have a foundation, so we skip what you have demonstrated and start where the work begins.'}
        </p>
        <p className="text-sm text-ink-muted" data-testid="profile-summary">
          Voice: {outcome.profile.settings.voice}. Dialect: {outcome.profile.settings.dialect}. You
          can change both in Settings later.
        </p>
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
          onClick={() => router.push('/today')}
          data-testid="start-day-1"
        >
          Start Day 1
        </button>
      </section>
    );
  }

  return <p>Loading...</p>;
}
