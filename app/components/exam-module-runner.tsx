'use client';

import { useEffect, useState } from 'react';
import type { Skill } from '@/lib/db/curriculum';
import { moduleTimer, type ExamModule, type ExamResult } from '@/lib/assessment/b1-exam';
import { ActionRow, Button, ButtonLink, StatusChip } from './ui';
import { FocusHeading } from './focus-heading';

// B1 exam canvas (owner-directed redesign 2026-07-10): an exam is a mode,
// not a page. A quiet sticky exam bar keeps module, progress, and the
// monospace timer in view (amber under 5 minutes, error-tinted under 1);
// a centered narrow column shows exactly one thing at a time: the stimulus
// on the warm reading surface, the question in display type, and full-width
// lettered option cards. Production tasks are numbered task cards with
// clickable checklist rows that visibly complete. Timing is enforced:
// expiry submits whatever is answered.

const MODULE_LABELS: Readonly<Record<Skill, string>> = {
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
};

const OPTION_LETTERS = ['A', 'B', 'C'] as const;

interface Position {
  readonly part: number;
  readonly item: number;
}

// "Schreiben Sie circa 80 Wörter." becomes a scannable chip on the task
// card; unmatched instructions simply get no chip.
function wordBudgetOf(instruction: string): string | null {
  const match = /circa\s+(\d+)\s+Wörter/i.exec(instruction);
  return match ? `≈ ${match[1]} Wörter` : null;
}

export function ExamModuleRunner({
  skill,
  module,
  source,
  submit,
}: {
  skill: Skill;
  module: ExamModule;
  source: 'gemini' | 'placeholder';
  submit: (input: unknown) => Promise<ExamResult>;
}) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [position, setPosition] = useState<Position>({ part: 0, item: 0 });
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [taskChecks, setTaskChecks] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [busy, setBusy] = useState(false);

  const objective = module.parts.length > 0;
  const totalItems = module.parts.reduce((sum, part) => sum + part.items.length, 0);

  // The clock runs from the pure timer; expiry submits what exists.
  useEffect(() => {
    if (!startedAt || result) return undefined;
    const tick = () => {
      const timer = moduleTimer(skill, startedAt, new Date());
      setRemaining(timer.remainingSeconds);
      if (timer.expired) void finish();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // finish is stable enough for this effect's lifetime; re-subscribing on
    // every state change would reset the interval each second anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, result, skill]);

  async function finish(): Promise<void> {
    if (busy || result) return;
    setBusy(true);
    const outcome = await submit(
      objective
        ? { skill, kind: 'objective', correct: correctCount }
        : {
            skill,
            kind: 'production',
            taskScores: module.productionTasks.map((task, taskIndex) => {
              const covered = task.contentPoints.filter(
                (_, pointIndex) => taskChecks[`${taskIndex}-${pointIndex}`],
              ).length;
              return Math.round((100 * covered) / task.contentPoints.length);
            }),
          },
    );
    setBusy(false);
    setResult(outcome);
  }

  function answer(correct: boolean): void {
    const nextCorrect = correctCount + (correct ? 1 : 0);
    const nextAnswered = answeredCount + 1;
    setCorrectCount(nextCorrect);
    setAnsweredCount(nextAnswered);
    const part = module.parts[position.part];
    if (part && position.item + 1 < part.items.length) {
      setPosition({ ...position, item: position.item + 1 });
    } else if (position.part + 1 < module.parts.length) {
      setPosition({ part: position.part + 1, item: 0 });
    } else {
      // Last item answered: submit with the final tallies directly (state
      // updates have not committed yet).
      setBusy(true);
      void submit({ skill, kind: 'objective', correct: nextCorrect }).then((outcome) => {
        setBusy(false);
        setResult(outcome);
      });
    }
  }

  if (result) {
    return (
      <section
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10 text-center"
        data-testid="exam-module-result"
      >
        <FocusHeading key="result">{MODULE_LABELS[skill]}: result</FocusHeading>
        <p
          className="font-display text-7xl font-semibold tracking-tight"
          aria-hidden
          data-testid="exam-score-display"
        >
          {result.score}
        </p>
        <p role="status" data-testid="exam-module-score">
          Score: {result.score} / 100.{' '}
          <StatusChip tone={result.passed ? 'success' : 'neutral'} data-testid="exam-module-passed">
            {result.passed ? 'Bestanden (60+)' : 'Below 60: not passed'}
          </StatusChip>
        </p>
        <ActionRow className="justify-center">
          <ButtonLink variant="primary" href="/exam" data-testid="exam-back">
            Back to the exam overview
          </ButtonLink>
        </ActionRow>
      </section>
    );
  }

  if (!startedAt) {
    return (
      <section
        className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10"
        data-testid="exam-module-intro"
      >
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-surface p-8 text-center">
          <p className="font-display text-4xl font-semibold tracking-tight">
            {MODULE_LABELS[skill]}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <StatusChip tone="neutral">
              {objective
                ? `${module.parts.length} Teile · ${totalItems} items`
                : `${module.productionTasks.length} Aufgaben`}
            </StatusChip>
            <StatusChip tone="neutral">Goethe timing enforced</StatusChip>
          </div>
          <p className="max-w-prose text-sm text-ink-muted">
            The official timer starts when you begin and submits automatically at zero.
            {source === 'placeholder'
              ? ' Practice content: the brain is offline, so this sitting uses the deterministic filler.'
              : ''}
          </p>
          <ActionRow className="justify-center pt-2">
            <Button onClick={() => setStartedAt(new Date().toISOString())} data-testid="exam-start">
              Start {MODULE_LABELS[skill]}
            </Button>
          </ActionRow>
        </div>
      </section>
    );
  }

  const minutes = Math.floor((remaining ?? 0) / 60);
  const seconds = (remaining ?? 0) % 60;
  const low = remaining !== null && remaining < 300;
  const critical = remaining !== null && remaining < 60;
  const progressPercent = objective
    ? Math.round((100 * answeredCount) / Math.max(1, totalItems))
    : Math.round(
        (100 * Object.values(taskChecks).filter(Boolean).length) /
          Math.max(
            1,
            module.productionTasks.reduce((sum, task) => sum + task.contentPoints.length, 0),
          ),
      );

  // The exam bar: always in view, never loud. Progress on the left, the
  // clock on the right; the clock alone changes color as time runs low, and
  // the text label carries the same information (never color alone).
  const examBar = (
    <div className="sticky top-[var(--header-h)] z-[5] -mx-4 border-b border-border-default bg-surface px-4 py-2 sm:-mx-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
        <p className="text-sm font-medium">
          {MODULE_LABELS[skill]}
          <span className="text-ink-subtle"> · {progressPercent}% done</span>
        </p>
        <p
          className={`font-mono text-sm tabular-nums ${
            critical
              ? 'rounded-md bg-error-tint px-2 py-0.5 text-[var(--color-error)]'
              : low
                ? 'rounded-md bg-[var(--highlight-date-color)] px-2 py-0.5 text-[var(--highlight-date-text-color)]'
                : 'text-ink-muted'
          }`}
          role="timer"
          data-testid="exam-timer"
        >
          {critical ? 'Time almost up · ' : low ? 'Under 5 min · ' : ''}
          {minutes}:{String(seconds).padStart(2, '0')}
        </p>
      </div>
      <div
        className="mx-auto mt-2 h-1 w-full max-w-2xl overflow-hidden rounded-pill bg-surface-2"
        aria-hidden
      >
        <div
          className="h-full rounded-pill transition-[width] duration-[var(--motion-base)]"
          style={{ width: `${progressPercent}%`, background: 'var(--highlight-date-color)' }}
        />
      </div>
    </div>
  );

  if (objective) {
    const part = module.parts[position.part];
    const item = part?.items[position.item];
    if (!part || !item) return null;
    return (
      <section className="flex flex-col" data-testid="exam-module-objective">
        {examBar}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
              Teil {part.part} · Frage {position.item + 1} von {part.items.length}
            </p>
            <FocusHeading key={`${position.part}-${position.item}`} className="sr-only">
              Teil {part.part}: item {position.item + 1} of {part.items.length} ({answeredCount + 1}{' '}
              of {totalItems} total)
            </FocusHeading>
          </div>
          <div className="rounded-lg border-l-4 border-[var(--highlight-date-color)] bg-reading-surface p-5">
            <p className="font-reading leading-relaxed text-reading-ink" lang="de">
              {item.stimulus}
            </p>
          </div>
          <p className="font-display text-xl font-semibold" data-testid="exam-question">
            {item.question}
          </p>
          <div className="flex flex-col gap-3" role="group" aria-label="Antworten">
            {item.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                lang="de"
                className="group flex w-full items-center gap-4 rounded-lg border border-border-default bg-surface p-4 text-left transition-colors duration-[var(--motion-fast)] hover:border-border-strong hover:bg-surface-2"
                onClick={() => answer(optionIndex === item.correctIndex)}
                data-testid="exam-option"
                data-correct={optionIndex === item.correctIndex}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border-default bg-surface-2 text-sm font-semibold text-ink-muted group-hover:border-border-strong group-hover:text-ink"
                >
                  {OPTION_LETTERS[optionIndex] ?? optionIndex + 1}
                </span>
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col" data-testid="exam-module-production">
      {examBar}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8">
        <FocusHeading key="production" className="sr-only">
          {MODULE_LABELS[skill]}: tasks
        </FocusHeading>
        {module.productionTasks.map((task, taskIndex) => {
          const budget = wordBudgetOf(task.instruction);
          const covered = task.contentPoints.filter(
            (_, pointIndex) => taskChecks[`${taskIndex}-${pointIndex}`],
          ).length;
          return (
            <div
              key={taskIndex}
              className="flex flex-col gap-4 rounded-lg border bg-surface p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-action text-sm font-semibold text-action-inverse"
                >
                  {taskIndex + 1}
                </span>
                <p className="font-display text-lg font-semibold">Aufgabe {taskIndex + 1}</p>
                <span className="ml-auto flex gap-2">
                  {budget ? <StatusChip tone="neutral">{budget}</StatusChip> : null}
                  <StatusChip tone={covered === task.contentPoints.length ? 'success' : 'neutral'}>
                    {covered}/{task.contentPoints.length} covered
                  </StatusChip>
                </span>
              </div>
              <div className="rounded-lg border-l-4 border-[var(--highlight-date-color)] bg-reading-surface p-4">
                <p className="font-reading leading-relaxed text-reading-ink" lang="de">
                  {task.instruction}
                </p>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-sm text-ink-muted">
                  Work on paper or aloud, then check what you covered:
                </legend>
                {task.contentPoints.map((point, pointIndex) => {
                  const checked = taskChecks[`${taskIndex}-${pointIndex}`] ?? false;
                  return (
                    <label
                      key={pointIndex}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors duration-[var(--motion-fast)] ${
                        checked
                          ? 'border-transparent bg-[var(--color-success-tint)]'
                          : 'border-border-default bg-surface hover:bg-surface-2'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setTaskChecks((current) => ({
                            ...current,
                            [`${taskIndex}-${pointIndex}`]: event.target.checked,
                          }))
                        }
                        data-testid={`exam-task-${taskIndex}-point-${pointIndex}`}
                      />
                      <span lang="de" className={checked ? 'text-[var(--color-success)]' : ''}>
                        {point}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </div>
          );
        })}
        <ActionRow>
          <Button disabled={busy} onClick={() => void finish()} data-testid="exam-submit">
            Submit {MODULE_LABELS[skill]}
          </Button>
        </ActionRow>
      </div>
    </section>
  );
}
