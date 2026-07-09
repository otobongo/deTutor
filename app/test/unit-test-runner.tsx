'use client';

import { useState } from 'react';
import type { Skill } from '@/lib/db/curriculum';
import type { UnitProgressDoc } from '@/lib/db/learner';
import type { ObjectiveItem } from '@/lib/assessment/unit-test-gen';
import {
  getUnitTestForCurrentUnit,
  markRemediationDone,
  submitRetake,
  submitUnitTest,
  type UnitTestPayload,
} from '@/app/actions/assessment';

// Unit test runner (GT-401 journey 3). Objective sections are clicked
// through; production sections use the visible content-point checklist as a
// self-rubric in placeholder mode. Failing a skill routes to remediation,
// then a single-skill retake on a regenerated test.
// Option buttons carry data-correct for the open single-learner v1; the
// authoritative scoring happens server-side either way.

type Phase = 'objective' | 'production' | 'result' | 'retake';

interface ObjectiveProgress {
  readonly section: 'listening' | 'reading';
  readonly index: number;
}

export function UnitTestRunner({ initial }: { initial: UnitTestPayload }) {
  const [payload, setPayload] = useState<UnitTestPayload>(initial);
  const [phase, setPhase] = useState<Phase>('objective');
  const [cursor, setCursor] = useState<ObjectiveProgress>({ section: 'listening', index: 0 });
  const [listening, setListening] = useState<boolean[]>([]);
  const [reading, setReading] = useState<boolean[]>([]);
  const [writingPoints, setWritingPoints] = useState<boolean[]>([]);
  const [speakingPoints, setSpeakingPoints] = useState<boolean[]>([]);
  const [progress, setProgress] = useState<UnitProgressDoc | null>(null);
  const [complete, setComplete] = useState(false);
  const [retakeSkill, setRetakeSkill] = useState<Skill | null>(null);
  const [retakeAnswers, setRetakeAnswers] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);

  const test = payload.test;
  const items: readonly ObjectiveItem[] =
    cursor.section === 'listening' ? test.listening : test.reading;
  const currentItem = items[cursor.index];

  function answerObjective(correct: boolean): void {
    const record = cursor.section === 'listening' ? setListening : setReading;
    record((previous) => [...previous, correct]);
    if (cursor.index + 1 < items.length) {
      setCursor({ ...cursor, index: cursor.index + 1 });
    } else if (cursor.section === 'listening') {
      setCursor({ section: 'reading', index: 0 });
    } else {
      setWritingPoints(test.writing.contentPoints.map(() => false));
      setSpeakingPoints(test.speaking.contentPoints.map(() => false));
      setPhase('production');
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    const outcome = await submitUnitTest({
      test,
      listening,
      reading,
      writing: {
        errorCount: 0,
        contentPointsCovered: writingPoints.filter(Boolean).length,
        contentPointsTotal: writingPoints.length,
      },
      speaking: {
        errorCount: 0,
        contentPointsCovered: speakingPoints.filter(Boolean).length,
        contentPointsTotal: speakingPoints.length,
      },
    });
    setProgress(outcome.progress);
    setComplete(outcome.complete);
    setPhase('result');
    setBusy(false);
  }

  async function startRetake(skill: Skill): Promise<void> {
    setBusy(true);
    const updated = await markRemediationDone(test.unitId, skill);
    setProgress(updated);
    const fresh = await getUnitTestForCurrentUnit(2);
    if (fresh) setPayload(fresh);
    setRetakeSkill(skill);
    setRetakeAnswers([]);
    setPhase('retake');
    setBusy(false);
  }

  async function submitRetakeAnswers(answers: boolean[]): Promise<void> {
    if (!retakeSkill) return;
    setBusy(true);
    const outcome = await submitRetake({
      unitId: test.unitId,
      skill: retakeSkill,
      test: payload.test,
      objective: retakeSkill === 'listening' || retakeSkill === 'reading' ? answers : null,
      production: null,
    });
    setProgress(outcome.progress);
    setComplete(outcome.complete);
    setPhase('result');
    setBusy(false);
  }

  if (phase === 'objective' && currentItem) {
    return (
      <section className="flex flex-col gap-4" data-testid="unit-test-objective">
        <h2 className="text-xl font-medium capitalize">
          {cursor.section} ({cursor.index + 1} of {items.length})
        </h2>
        <p className="italic">{currentItem.stimulus}</p>
        <p data-testid="unit-test-question">{currentItem.question}</p>
        <div className="flex flex-col items-start gap-2">
          {currentItem.options.map((option, optionIndex) => (
            <button
              key={option + optionIndex}
              type="button"
              className="rounded border px-3 py-2"
              data-testid="unit-test-option"
              data-correct={optionIndex === currentItem.correctIndex}
              onClick={() => answerObjective(optionIndex === currentItem.correctIndex)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase === 'production') {
    return (
      <section className="flex flex-col gap-4" data-testid="unit-test-production">
        <h2 className="text-xl font-medium">Writing</h2>
        <p>{test.writing.instruction}</p>
        <textarea className="min-h-24 rounded border px-3 py-2" aria-label="Your text" />
        {test.writing.contentPoints.map((point, index) => (
          <label key={point} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={writingPoints[index] ?? false}
              onChange={(event) =>
                setWritingPoints(
                  writingPoints.map((value, i) => (i === index ? event.target.checked : value)),
                )
              }
              data-testid={`writing-point-${index}`}
            />
            {point}
          </label>
        ))}
        <h2 className="text-xl font-medium">Speaking</h2>
        <p>{test.speaking.instruction}</p>
        {test.speaking.contentPoints.map((point, index) => (
          <label key={point} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={speakingPoints[index] ?? false}
              onChange={(event) =>
                setSpeakingPoints(
                  speakingPoints.map((value, i) => (i === index ? event.target.checked : value)),
                )
              }
              data-testid={`speaking-point-${index}`}
            />
            {point}
          </label>
        ))}
        <button
          type="button"
          className="self-start rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
          disabled={busy}
          onClick={() => void submit()}
          data-testid="unit-test-submit"
        >
          Submit unit test
        </button>
      </section>
    );
  }

  if (phase === 'retake' && retakeSkill) {
    const retakeItems = retakeSkill === 'listening' ? payload.test.listening : payload.test.reading;
    const item = retakeItems[retakeAnswers.length];
    if (!item) return <p>Loading retake...</p>;
    return (
      <section className="flex flex-col gap-4" data-testid="unit-test-retake">
        <h2 className="text-xl font-medium">
          Retake: {retakeSkill} ({retakeAnswers.length + 1} of {retakeItems.length})
        </h2>
        <p className="italic">{item.stimulus}</p>
        <p>{item.question}</p>
        <div className="flex flex-col items-start gap-2">
          {item.options.map((option, optionIndex) => (
            <button
              key={option + optionIndex}
              type="button"
              className="rounded border px-3 py-2"
              data-testid="retake-option"
              data-correct={optionIndex === item.correctIndex}
              onClick={() => {
                const next = [...retakeAnswers, optionIndex === item.correctIndex];
                if (next.length === retakeItems.length) void submitRetakeAnswers(next);
                else setRetakeAnswers(next);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="unit-test-result">
      <h2 className="text-xl font-medium">Results ({payload.source} test)</h2>
      <ul className="flex flex-col gap-1">
        {progress
          ? Object.entries(progress.skills).map(([skill, entry]) => (
              <li key={skill} data-testid={`result-${skill}`} data-passed={entry.passed}>
                <span className="capitalize">{skill}</span>: {entry.score}{' '}
                {entry.passed ? '(passed)' : '(failed)'}
              </li>
            ))
          : null}
      </ul>
      {complete ? (
        <p data-testid="unit-complete">
          Unit {test.unitId.toUpperCase()} complete! All skills passed.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {progress
            ? Object.entries(progress.remediation)
                .filter(([, status]) => status === 'pending')
                .map(([skill]) => (
                  <div key={skill} className="flex flex-col gap-2 rounded border p-3">
                    <p data-testid={`remediation-${skill}`}>
                      Remediation for <span className="capitalize">{skill}</span>: drill{' '}
                      {test.unitId} grammar ({payload.unit.grammarItemIds.join(', ')}), then retake
                      that skill only.
                    </p>
                    <button
                      type="button"
                      className="self-start rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-40"
                      disabled={busy}
                      onClick={() => void startRetake(skill as Skill)}
                      data-testid={`remediate-and-retake-${skill}`}
                    >
                      Complete remediation and retake {skill}
                    </button>
                  </div>
                ))
            : null}
        </div>
      )}
    </section>
  );
}
