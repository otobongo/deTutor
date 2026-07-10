'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AudioAsset } from '@/lib/media/provider';
import type { FoundationTopic } from '@/db/seed/foundations';
import type { FoundationQuizOutcome } from '@/app/actions/learn';
import { AudioPlayer } from './audio-player';

// Foundation study page body (owner-directed 2026-07-10): explanation
// sections with tables and audible examples, then a scored self-check.
// Nothing gates on the result; the best score is kept and graded, and
// marking the topic learned stays the learner's call.

export function FoundationStudy({
  topic,
  exampleAudio,
  initialMarked,
  initialBestScore,
  submitQuiz,
  markLearned,
}: {
  topic: FoundationTopic;
  exampleAudio: Readonly<Record<string, AudioAsset>>;
  initialMarked: boolean;
  initialBestScore: number | null;
  submitQuiz: (topicId: string, answers: readonly number[]) => Promise<FoundationQuizOutcome>;
  markLearned: (topicId: string, marked: boolean) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<FoundationQuizOutcome | null>(null);
  const [marked, setMarked] = useState(initialMarked);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const [busy, setBusy] = useState(false);

  const allAnswered = topic.quiz.every((_, questionIndex) => answers[questionIndex] !== undefined);

  async function submit(): Promise<void> {
    if (busy || !allAnswered) return;
    setBusy(true);
    const outcome = await submitQuiz(
      topic.id,
      topic.quiz.map((_, questionIndex) => answers[questionIndex] as number),
    );
    setBusy(false);
    setResult(outcome);
    setBestScore(outcome.bestScore);
  }

  async function toggleMarked(): Promise<void> {
    if (busy) return;
    setBusy(true);
    await markLearned(topic.id, !marked);
    setMarked((current) => !current);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6" data-testid={`foundation-${topic.id}`}>
      {topic.sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
            {exampleAudio[`s${sectionIndex}-intro`] ? (
              <AudioPlayer
                asset={exampleAudio[`s${sectionIndex}-intro`]!}
                label={`Listen to: ${section.heading}`}
                variant="icon"
              />
            ) : null}
          </div>
          <p className="max-w-prose">{section.body}</p>
          {section.table ? (
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    {section.table.headers.map((header) => (
                      <th
                        key={header}
                        className="border border-border-default bg-surface-2 px-3 py-1 text-left"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border border-border-default px-3 py-1"
                          lang="de"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {section.examples && section.examples.length > 0 ? (
            // Fluid by count: one example breathes across the full width,
            // two or more arrange as columns on wider screens.
            <div
              className={
                section.examples.length > 1 ? 'grid gap-3 sm:grid-cols-2' : 'flex flex-col gap-3'
              }
            >
              {section.examples.map((example, exampleIndex) => {
                const audio = exampleAudio[`s${sectionIndex}-e${exampleIndex}`];
                return (
                  <div
                    key={exampleIndex}
                    className="flex items-start justify-between gap-3 rounded-lg bg-reading-surface p-3 font-reading text-reading-ink"
                  >
                    <div className="flex flex-col gap-1">
                      <p lang="de">{example.de}</p>
                      <p className="text-sm text-ink-muted">{example.en}</p>
                    </div>
                    {audio ? <AudioPlayer asset={audio} label="Hear it" variant="icon" /> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Check yourself</h2>
        {bestScore !== null ? (
          <p className="text-sm text-ink-muted" data-testid="foundation-best">
            Best score so far: {bestScore} / 100.
          </p>
        ) : null}
        <ol className="flex flex-col gap-4">
          {topic.quiz.map((question, questionIndex) => (
            <li key={questionIndex} className="flex flex-col gap-2">
              <span>{question.question}</span>
              <span className="flex flex-wrap gap-2" role="group" aria-label={question.question}>
                {question.options.map((option, optionIndex) => {
                  const chosen = answers[questionIndex] === optionIndex;
                  const showState =
                    result !== null && (optionIndex === question.correctIndex || chosen);
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      lang="de"
                      className={`rounded-md border px-3 py-1 text-sm ${
                        chosen
                          ? 'border-border-strong bg-action text-action-inverse'
                          : 'border-border-default bg-surface hover:bg-surface-2'
                      } ${
                        showState && optionIndex === question.correctIndex
                          ? 'ring-2 ring-[var(--color-success)]'
                          : ''
                      }`}
                      disabled={result !== null}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))
                      }
                      data-testid={`quiz-${questionIndex}-${optionIndex}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
        </ol>
        {result === null ? (
          <button
            type="button"
            className="self-start rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
            disabled={!allAnswered || busy}
            onClick={() => void submit()}
            data-testid="quiz-submit"
          >
            Check answers
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p role="status" data-testid="quiz-result">
              {result.correct} of {result.total} correct: {result.score} / 100, grade {result.grade}
              . Best: {result.bestScore} / 100.
            </p>
            <button
              type="button"
              className="self-start rounded-md border border-border-default bg-surface px-4 py-2"
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
              data-testid="quiz-retake"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`rounded-md px-4 py-2 disabled:opacity-40 ${
            marked ? 'border border-border-default bg-surface' : 'bg-action text-action-inverse'
          }`}
          disabled={busy}
          onClick={() => void toggleMarked()}
          data-testid="foundation-mark"
        >
          {marked ? 'Learned ✓ (tap to unmark)' : 'Mark as learned'}
        </button>
        <Link className="text-sm underline" href="/learn">
          Back to Learn
        </Link>
      </div>
    </div>
  );
}
