'use client';

import { useEffect, useState } from 'react';
import type { Skill } from '@/lib/db/curriculum';
import { moduleTimer, type ExamModule, type ExamResult } from '@/lib/assessment/b1-exam';
import { ActionRow, Button, ButtonLink, StatusChip } from './ui';
import { FocusHeading } from './focus-heading';

// B1 exam module runner (owner-directed 2026-07-10): the official timing is
// enforced (expiry submits whatever is answered), objective parts run item
// by item, production tasks self-score against their content points like
// the unit test rubric. One sitting per visit; the result persists.

const MODULE_LABELS: Readonly<Record<Skill, string>> = {
  reading: 'Lesen',
  listening: 'Hören',
  writing: 'Schreiben',
  speaking: 'Sprechen',
};

interface Position {
  readonly part: number;
  readonly item: number;
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
      <section className="flex flex-col gap-4" data-testid="exam-module-result">
        <FocusHeading key="result">{MODULE_LABELS[skill]}: result</FocusHeading>
        <p role="status" data-testid="exam-module-score">
          Score: {result.score} / 100.{' '}
          <StatusChip tone={result.passed ? 'success' : 'neutral'} data-testid="exam-module-passed">
            {result.passed ? 'Bestanden (60+)' : 'Below 60: not passed'}
          </StatusChip>
        </p>
        <ActionRow>
          <ButtonLink variant="primary" href="/exam" data-testid="exam-back">
            Back to the exam overview
          </ButtonLink>
        </ActionRow>
      </section>
    );
  }

  if (!startedAt) {
    return (
      <section className="flex flex-col gap-4" data-testid="exam-module-intro">
        <p>
          {objective
            ? `${module.parts.length} parts, ${totalItems} items.`
            : `${module.productionTasks.length} production tasks.`}{' '}
          The official timer starts when you begin and submits automatically at zero.
          {source === 'placeholder'
            ? ' (Practice content: the brain is offline, so this sitting uses the deterministic filler.)'
            : ''}
        </p>
        <ActionRow>
          <Button onClick={() => setStartedAt(new Date().toISOString())} data-testid="exam-start">
            Start {MODULE_LABELS[skill]}
          </Button>
        </ActionRow>
      </section>
    );
  }

  const minutes = Math.floor((remaining ?? 0) / 60);
  const seconds = (remaining ?? 0) % 60;
  const timerLine = (
    <p className="text-sm text-ink-muted" role="timer" data-testid="exam-timer">
      Time remaining: {minutes}:{String(seconds).padStart(2, '0')}
    </p>
  );

  if (objective) {
    const part = module.parts[position.part];
    const item = part?.items[position.item];
    if (!part || !item) return null;
    return (
      <section className="flex flex-col gap-4" data-testid="exam-module-objective">
        <FocusHeading key={`${position.part}-${position.item}`}>
          Teil {part.part}: item {position.item + 1} of {part.items.length} ({answeredCount + 1} of{' '}
          {totalItems} total)
        </FocusHeading>
        {timerLine}
        <p className="rounded-lg bg-reading-surface p-4 font-reading text-reading-ink" lang="de">
          {item.stimulus}
        </p>
        <p data-testid="exam-question">{item.question}</p>
        <div className="flex flex-col items-stretch gap-2 sm:items-start">
          {item.options.map((option, optionIndex) => (
            <Button
              key={optionIndex}
              variant="secondary"
              className="justify-start text-left"
              lang="de"
              onClick={() => answer(optionIndex === item.correctIndex)}
              data-testid="exam-option"
              data-correct={optionIndex === item.correctIndex}
            >
              {option}
            </Button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" data-testid="exam-module-production">
      <FocusHeading key="production">{MODULE_LABELS[skill]}: tasks</FocusHeading>
      {timerLine}
      {module.productionTasks.map((task, taskIndex) => (
        <div key={taskIndex} className="flex flex-col gap-2 rounded-lg border bg-surface p-4">
          <p className="font-medium">Aufgabe {taskIndex + 1}</p>
          <p lang="de">{task.instruction}</p>
          <p className="text-sm text-ink-muted">
            Work on paper or aloud, then check what you covered:
          </p>
          {task.contentPoints.map((point, pointIndex) => (
            <label key={pointIndex} className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={taskChecks[`${taskIndex}-${pointIndex}`] ?? false}
                onChange={(event) =>
                  setTaskChecks((current) => ({
                    ...current,
                    [`${taskIndex}-${pointIndex}`]: event.target.checked,
                  }))
                }
                data-testid={`exam-task-${taskIndex}-point-${pointIndex}`}
              />
              {point}
            </label>
          ))}
        </div>
      ))}
      <ActionRow>
        <Button disabled={busy} onClick={() => void finish()} data-testid="exam-submit">
          Submit {MODULE_LABELS[skill]}
        </Button>
      </ActionRow>
    </section>
  );
}
