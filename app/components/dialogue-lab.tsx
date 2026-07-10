'use client';

import { useEffect, useState } from 'react';
import type { DialogueLabPayload } from '@/app/actions/dialogue';
import type { ListeningEvaluationOutcome } from '@/app/actions/lesson';
import { gradeWordIdentification, type IdentificationResult } from '@/lib/exercises/dialogue';
import { AudioPlayer } from './audio-player';

// Dialogue lab (owner-directed 2026-07-10): a spoken conversation heard
// before it is read. Phases: listen (transcript hidden when the audio is
// real; captioned placeholder audio shows it, GT-007 contract), identify
// the words you heard, explain what happened (brain-evaluated), then the
// transcript reveals with per-line replay. The listening score records on
// completion; a brain outage is a recoverable state, never a dead end.

type Phase = 'listen' | 'identify' | 'explain' | 'transcript';

export function DialogueLab({
  load,
  evaluate,
  recordScore,
  onDone,
}: {
  load: () => Promise<DialogueLabPayload | null>;
  evaluate: (input: {
    clipText: string;
    learnerResponse: string;
    level: 'A1' | 'A2' | 'B1';
  }) => Promise<ListeningEvaluationOutcome>;
  recordScore: (score: number) => Promise<void>;
  onDone: (score: number | null) => void;
}) {
  const [payload, setPayload] = useState<DialogueLabPayload | null | 'loading'>('loading');
  const [phase, setPhase] = useState<Phase>('listen');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((loaded) => {
        if (!cancelled) setPayload(loaded);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (payload === 'loading') {
    return <p data-testid="dialogue-loading">Setting up today&apos;s conversation&hellip;</p>;
  }
  if (payload === null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status">The conversation could not be prepared today.</p>
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
          onClick={() => onDone(null)}
          data-testid="dialogue-skip"
        >
          Continue
        </button>
      </div>
    );
  }

  const transcriptVisible = payload.audio.captionsRequired || phase === 'transcript';

  function toggleWord(wordId: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  function checkIdentification(): void {
    if (payload === null || payload === 'loading') return;
    setIdentification(gradeWordIdentification(payload.identification, [...selected]));
  }

  async function submitExplanation(): Promise<void> {
    if (busy || payload === null || payload === 'loading') return;
    setBusy(true);
    const outcome = await evaluate({
      clipText: payload.dialogue.turns.map((turn) => turn.text).join(' '),
      learnerResponse: explanation,
      level: 'A1',
    });
    setBusy(false);
    setFeedback(
      outcome.ok
        ? outcome.evaluation.verdict.feedback
        : 'The evaluation brain is not reachable (' +
            outcome.category +
            '). Compare your summary with the transcript on the next step.',
    );
  }

  async function finish(): Promise<void> {
    const score = identification?.score ?? null;
    if (score !== null) await recordScore(score);
    onDone(score);
  }

  return (
    <div className="flex flex-col gap-5" data-testid="dialogue-lab">
      <div className="flex flex-col gap-2 rounded-lg border bg-surface p-4">
        <h3 className="font-medium" lang="de" data-testid="dialogue-title">
          {payload.dialogue.title}
        </h3>
        <p className="text-sm text-ink-muted">
          Two people are talking. Listen as often as you like
          {payload.audio.captionsRequired
            ? '. (Placeholder audio: the transcript stays visible.)'
            : ', without reading along.'}
          {payload.source === 'fallback' ? ' (Curated conversation: the brain is offline.)' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <AudioPlayer asset={payload.audio} label="Play the conversation" />
          <AudioPlayer asset={payload.audio} label="Play slower" rate={0.8} />
        </div>
      </div>

      {transcriptVisible ? (
        <ol className="flex flex-col gap-2" data-testid="dialogue-transcript">
          {payload.dialogue.turns.map((turn, index) => (
            <li
              key={index}
              lang="de"
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                turn.speaker === 'Anna' ? 'self-start bg-surface-2' : 'self-end bg-reading-surface'
              }`}
            >
              <span className="block text-xs text-ink-subtle">{turn.speaker}</span>
              {turn.text}
            </li>
          ))}
        </ol>
      ) : null}

      {phase === 'listen' ? (
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
          onClick={() => setPhase('identify')}
          data-testid="dialogue-to-identify"
        >
          I listened, on to the words
        </button>
      ) : null}

      {phase === 'identify' ? (
        <div className="flex flex-col gap-3" data-testid="dialogue-identify">
          <p className="text-sm font-medium">Which of these words did you hear?</p>
          <div className="flex flex-wrap gap-2">
            {payload.identification.map((option) => (
              <button
                key={option.wordId}
                type="button"
                className={`rounded-pill border px-3 py-1 text-sm ${
                  selected.has(option.wordId)
                    ? 'border-border-strong bg-action text-action-inverse'
                    : 'border-border-default bg-surface hover:bg-surface-2'
                }`}
                disabled={identification !== null}
                onClick={() => toggleWord(option.wordId)}
                aria-pressed={selected.has(option.wordId)}
                data-testid={`identify-${option.wordId}`}
              >
                <span lang="de">{option.label}</span>
              </button>
            ))}
          </div>
          {identification === null ? (
            <button
              type="button"
              className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
              onClick={checkIdentification}
              data-testid="identify-check"
            >
              Check
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p role="status" data-testid="identify-score">
                {identification.correct} of {identification.total} right: {identification.score} /
                100.
              </p>
              <button
                type="button"
                className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
                onClick={() => setPhase('explain')}
                data-testid="dialogue-to-explain"
              >
                Next: what happened?
              </button>
            </div>
          )}
        </div>
      ) : null}

      {phase === 'explain' ? (
        <div className="flex flex-col gap-3" data-testid="dialogue-explain">
          <label className="flex flex-col gap-1 text-sm font-medium">
            In one or two English sentences: what was the conversation about?
            <textarea
              className="min-h-20 rounded-md border bg-surface px-3 py-2 font-normal"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              disabled={feedback !== null}
              data-testid="explain-input"
            />
          </label>
          {feedback === null ? (
            <button
              type="button"
              className="self-start rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
              disabled={busy || explanation.trim().length === 0}
              onClick={() => void submitExplanation()}
              data-testid="explain-submit"
            >
              Check my understanding
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p role="status" data-testid="explain-feedback">
                {feedback}
              </p>
              <button
                type="button"
                className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
                onClick={() => setPhase('transcript')}
                data-testid="dialogue-to-transcript"
              >
                Show the transcript
              </button>
            </div>
          )}
        </div>
      ) : null}

      {phase === 'transcript' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-muted">
            Read along and replay lines you found hard; repeating them aloud is the best finish.
          </p>
          <button
            type="button"
            className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
            onClick={() => void finish()}
            data-testid="skill-continue"
          >
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
