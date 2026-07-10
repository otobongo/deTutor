'use client';

import { useEffect, useState } from 'react';
import type {
  ScenarioEndOutcome,
  ScenarioSnapshot,
  ScenarioStartPayload,
  ScenarioTurnOutcome,
} from '@/app/actions/scenario';
import type { ScenarioSummary } from '@/lib/scenarios/summary';
import type { GrammarErrorCategory } from '@/lib/db/learner';
import { ScenarioSummaryView } from './scenario-summary';
import { ActionRow, Button } from './ui';

// Scenario chat (GT-216/218 UI): the learner talks, the persona answers in
// scene, corrections ride inline in the fixed Gut!/Fast! format, and ending
// the scene renders the summary table. A brain outage is a recoverable state
// with an explicit way onward, never a dead end.

const MIN_TURNS_TO_END = 1;

export function ScenarioChat({
  start,
  turn,
  end,
  onDone,
}: {
  start: () => Promise<ScenarioStartPayload | null>;
  turn: (snapshot: ScenarioSnapshot, learnerInput: string) => Promise<ScenarioTurnOutcome>;
  end: (snapshot: ScenarioSnapshot) => Promise<ScenarioEndOutcome>;
  // Corrections' grammar categories ride along so the session report's
  // error tally counts scenario mistakes too (gap closed 2026-07-10).
  onDone: (scenarioScore: number | null, errorCategories: readonly GrammarErrorCategory[]) => void;
}) {
  const [payload, setPayload] = useState<ScenarioStartPayload | null | 'loading'>('loading');
  const [snapshot, setSnapshot] = useState<ScenarioSnapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
  const [ending, setEnding] = useState<{
    summary: ScenarioSummary | null;
    score: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void start().then((started) => {
      if (cancelled) return;
      setPayload(started);
      setSnapshot(started?.snapshot ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  if (payload === 'loading') return <p data-testid="scenario-loading">Setting the scene&hellip;</p>;
  if (payload === null || snapshot === null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status">No scenario is available today.</p>
        <ActionRow>
          <Button onClick={() => onDone(null, [])} data-testid="scenario-skip">
            Continue
          </Button>
        </ActionRow>
      </div>
    );
  }

  if (ending) {
    return (
      <div className="flex flex-col gap-4">
        {ending.summary ? (
          <ScenarioSummaryView summary={ending.summary} />
        ) : (
          <p role="status" data-testid="scenario-summary-offline">
            Your corrections were saved, but scoring needs the brain and it is not reachable.
          </p>
        )}
        {ending.score !== null ? (
          <p data-testid="scenario-score">Scenario score: {ending.score} / 10.</p>
        ) : null}
        <ActionRow>
          <Button
            onClick={() =>
              onDone(
                ending.score,
                snapshot.corrections.map((correction) => correction.category),
              )
            }
            data-testid="skill-continue"
          >
            Continue
          </Button>
        </ActionRow>
      </div>
    );
  }

  const learnerTurns = snapshot.messages.filter((message) => message.role === 'learner').length;
  const lastCorrection = snapshot.corrections[snapshot.corrections.length - 1];
  const lastMessage = snapshot.messages[snapshot.messages.length - 1];

  async function send(): Promise<void> {
    const input = draft.trim();
    if (input.length === 0 || busy || snapshot === null) return;
    setBusy(true);
    setOffline(null);
    const outcome = await turn(snapshot, input);
    setBusy(false);
    if (outcome.ok) {
      setSnapshot(outcome.snapshot);
      setDraft('');
    } else {
      setOffline(outcome.category);
    }
  }

  async function finish(): Promise<void> {
    if (busy || snapshot === null) return;
    setBusy(true);
    const outcome = await end(snapshot);
    setBusy(false);
    setEnding(
      outcome.ok
        ? { summary: outcome.summary, score: outcome.score }
        : { summary: null, score: null },
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="scenario-chat">
      <div className="rounded-lg border bg-surface p-4">
        <h3 className="font-medium">{payload.scenario.title}</h3>
        <p className="text-sm text-ink-muted">{payload.scenario.setting}</p>
        <p className="text-sm text-ink-muted">
          You are talking to: {payload.scenario.personaDescription}
        </p>
      </div>

      <ol className="flex flex-col gap-2" data-testid="scenario-messages" aria-live="polite">
        {snapshot.messages.map((message, index) => (
          <li
            key={index}
            lang="de"
            className={
              message.role === 'tutor'
                ? 'self-start rounded-lg bg-surface-2 px-3 py-2'
                : 'self-end rounded-lg bg-action px-3 py-2 text-action-inverse'
            }
            data-testid={`scenario-message-${message.role}`}
          >
            {message.text}
          </li>
        ))}
        {lastCorrection && lastMessage?.role === 'tutor' ? (
          <li
            className="list-none rounded-md border border-border-default bg-surface p-2 text-sm"
            data-testid="scenario-correction"
          >
            <span className="font-medium">{lastCorrection.acknowledgment}</span>{' '}
            <span lang="de">{lastCorrection.better}</span> ({lastCorrection.reason})
          </li>
        ) : null}
      </ol>

      {offline ? (
        <p
          role="status"
          className="rounded-md bg-error-tint p-2 text-sm text-error"
          data-testid="scenario-offline"
        >
          The scenario brain is not reachable ({offline}). Try again, or end the scene and move on.
        </p>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="w-full rounded-md border bg-surface px-3 py-2"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Auf Deutsch, bitte!"
          aria-label="Your reply in German"
          disabled={busy}
          data-testid="scenario-input"
        />
        <Button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          data-testid="scenario-send"
        >
          Send
        </Button>
      </form>

      {learnerTurns >= MIN_TURNS_TO_END || offline ? (
        <ActionRow>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void finish()}
            data-testid="scenario-end"
          >
            End scene
          </Button>
        </ActionRow>
      ) : null}
    </div>
  );
}
