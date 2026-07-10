'use client';

import { useEffect, useState } from 'react';
import type { ReadingExercisePayload, ReadingSubmission, TapOutcome } from '@/app/actions/reading';
import { ActionRow, Button, Chip } from './ui';

// Reading slot (GT-207/208/209 UI): the text renders word by word so every
// word is tappable; tapping shows the card essentials and quietly enqueues
// an FSRS card. Below the text, the Goethe richtig/falsch items score
// deterministically. Prop-driven loaders keep the component testable.

export function ReadingPanel({
  load,
  tap,
  submit,
  onDone,
}: {
  load: () => Promise<ReadingExercisePayload | null>;
  tap: (token: string) => Promise<TapOutcome>;
  submit: (task: unknown, answers: readonly boolean[]) => Promise<ReadingSubmission | null>;
  onDone: (score: number | null) => void;
}) {
  const [exercise, setExercise] = useState<ReadingExercisePayload | null | 'loading'>('loading');
  const [tapped, setTapped] = useState<{ token: string; outcome: TapOutcome } | null>(null);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<ReadingSubmission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void load().then((payload) => {
      if (!cancelled) setExercise(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (exercise === 'loading') {
    return (
      <p role="status" data-testid="reading-loading">
        Preparing today&apos;s text&hellip;
      </p>
    );
  }
  if (exercise === null || exercise.task.format !== 'richtig-falsch') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status">The reading exercise could not be prepared today.</p>
        <ActionRow>
          <Button onClick={() => onDone(null)} data-testid="reading-skip">
            Continue
          </Button>
        </ActionRow>
      </div>
    );
  }

  const items = exercise.task.items;
  const allAnswered = items.every((_, index) => answers[index] !== undefined);
  const tokens = exercise.text.split(/(\s+)/);

  return (
    <div className="flex flex-col gap-4" data-testid="reading-panel">
      <h3 className="font-medium" lang="de">
        {exercise.title}
      </h3>
      <p className="rounded-lg bg-reading-surface p-4 leading-relaxed" lang="de">
        {tokens.map((token, index) =>
          /\S/.test(token) ? (
            <button
              key={index}
              type="button"
              className="rounded-sm hover:bg-surface-2 focus-visible:bg-surface-2"
              onClick={() => {
                void tap(token).then((outcome) => setTapped({ token, outcome }));
              }}
              data-testid={`reading-word-${index}`}
            >
              {token}
            </button>
          ) : (
            token
          ),
        )}
      </p>
      <p className="text-xs text-ink-subtle">
        Tap any word to see its card and add it to your review deck.
        {exercise.source === 'fallback' ? ' (Curated text: the brain is offline.)' : ''}
      </p>
      {tapped ? (
        <p
          className="rounded-md border border-border-default bg-surface p-2 text-sm"
          role="status"
          data-testid="tap-result"
        >
          {tapped.outcome.kind === 'corpus'
            ? `${tapped.outcome.word.article ? `${tapped.outcome.word.article} ` : ''}${tapped.outcome.word.german}: ${tapped.outcome.word.translation}. ${tapped.outcome.added ? 'Added to your deck.' : 'Already in your deck.'}`
            : tapped.outcome.kind === 'mini'
              ? `${tapped.outcome.article ? `${tapped.outcome.article} ` : ''}${tapped.outcome.german}: ${tapped.outcome.translation}. ${tapped.outcome.added ? 'Added to your deck.' : 'Already in your deck.'}`
              : `No card available for "${tapped.token}" right now.`}
        </p>
      ) : null}

      <ol className="flex flex-col gap-3" data-testid="reading-items">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-1">
            <span lang="de">{item.statement}</span>
            <span className="flex gap-2" role="group" aria-label={`Statement ${index + 1}`}>
              {[true, false].map((value) => (
                <Chip
                  key={String(value)}
                  selected={answers[index] === value}
                  disabled={result !== null}
                  onClick={() => setAnswers({ ...answers, [index]: value })}
                  data-testid={`reading-answer-${index}-${value ? 'richtig' : 'falsch'}`}
                >
                  {value ? 'Richtig' : 'Falsch'}
                </Chip>
              ))}
            </span>
          </li>
        ))}
      </ol>

      {result === null ? (
        <ActionRow>
          <Button
            disabled={!allAnswered || busy}
            onClick={() => {
              setBusy(true);
              void submit(
                exercise.task,
                items.map((_, index) => answers[index] as boolean),
              ).then((submission) => {
                setBusy(false);
                setResult(submission ?? { correct: 0, total: items.length, score: 0 });
              });
            }}
            data-testid="reading-submit"
          >
            Check answers
          </Button>
        </ActionRow>
      ) : (
        <div className="flex flex-col gap-2">
          <p role="status" data-testid="reading-score">
            {result.correct} of {result.total} correct: {result.score} / 100.
          </p>
          <ActionRow>
            <Button onClick={() => onDone(result.score)} data-testid="skill-continue">
              Continue
            </Button>
          </ActionRow>
        </div>
      )}
    </div>
  );
}
