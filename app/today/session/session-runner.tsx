'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LessonSession } from '@/lib/db/learner';
import { completeStep, currentStep } from '@/lib/lesson/engine';
import { gradeTileOrder } from '@/lib/exercises/word-tiles';
import type { ListeningClip } from '@/app/components/listening-exercise';
import { ListeningExercise } from '@/app/components/listening-exercise';
import { EchoFlow } from '@/app/components/echo-flow';
import { VocabCard } from '@/app/components/vocab-card';
import {
  completeSession,
  evaluateListeningAction,
  saveSession,
  type TodaySessionPayload,
} from '@/app/actions/lesson';

// The daily session runner (GT-220): walks the five GT-108 steps in order,
// persisting after each so an interrupted session resumes at its step.
// Brain-dependent evaluation renders failures as recoverable states.

export function SessionRunner({ payload }: { payload: TodaySessionPayload }) {
  const router = useRouter();
  const [session, setSession] = useState<LessonSession>(payload.session);
  const [echoIndex, setEchoIndex] = useState(0);
  const [grammarProduction, setGrammarProduction] = useState('');
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const [tileFeedback, setTileFeedback] = useState<string | null>(null);
  const [listeningFeedback, setListeningFeedback] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [grammarScore, setGrammarScore] = useState(7);
  const [done, setDone] = useState(false);

  const step = currentStep(session);
  const echoWords = payload.dayWords.slice(0, 3);

  async function advance(extra?: { grammarScore?: number }): Promise<void> {
    const next = completeStep(session, { learnerProduced: true, ...extra });
    setSession(next);
    if (next.status === 'completed') {
      await completeSession({
        session: next,
        warmupRatings: [],
        imageIdResults: [],
        scenarioScore: null,
      });
      setDone(true);
    } else {
      await saveSession(next);
    }
  }

  if (done) {
    return (
      <section className="flex flex-col gap-4" data-testid="session-complete">
        <h2 className="text-xl font-medium">Session complete!</h2>
        <p>
          Rule practiced: {payload.grammarItem.name}. New words started: {payload.dayWords.length}.
          Tomorrow rotates to the next skill.
        </p>
        <button
          type="button"
          className="self-start rounded bg-blue-700 px-4 py-2 text-white"
          onClick={() => router.push('/today')}
          data-testid="back-to-today"
        >
          Back to Today
        </button>
      </section>
    );
  }

  if (step.kind === 'warm-up') {
    return (
      <section className="flex flex-col gap-4" data-testid="step-warm-up-view">
        <h2 className="text-xl font-medium">Warm-up</h2>
        {step.queueWordIds.length === 0 ? (
          <p>No review cards due yet; they start accumulating from today&apos;s new words.</p>
        ) : (
          <p>{step.queueWordIds.length} cards to review.</p>
        )}
        <button
          type="button"
          className="self-start rounded bg-blue-700 px-4 py-2 text-white"
          onClick={() => void advance()}
          data-testid="warmup-continue"
        >
          Continue
        </button>
      </section>
    );
  }

  if (step.kind === 'new-vocabulary') {
    const word = echoWords[echoIndex];
    return (
      <section className="flex flex-col gap-4" data-testid="step-vocab-view">
        <h2 className="text-xl font-medium">
          New vocabulary: {step.theme} ({Math.min(echoIndex + 1, echoWords.length)} of{' '}
          {echoWords.length} echoed, {payload.dayWords.length} in today&apos;s set)
        </h2>
        {word && payload.wordAudio[word.id] ? (
          <EchoFlow
            key={word.id}
            word={word}
            audio={payload.wordAudio[word.id]!}
            onDone={() => setEchoIndex((index) => index + 1)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p>Preview of the rest of today&apos;s set:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {payload.dayWords.slice(3, 7).map((preview) => (
                <VocabCard key={preview.id} word={preview} />
              ))}
            </div>
            <button
              type="button"
              className="self-start rounded bg-blue-700 px-4 py-2 text-white"
              onClick={() => void advance()}
              data-testid="vocab-continue"
            >
              Continue
            </button>
          </div>
        )}
      </section>
    );
  }

  if (step.kind === 'grammar-focus') {
    return (
      <section className="flex flex-col gap-4" data-testid="step-grammar-view">
        <h2 className="text-xl font-medium">Grammar focus: {payload.grammarItem.name}</h2>
        <p className="text-sm opacity-80">
          One rule per session. Try producing one sentence that uses it:
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (grammarProduction.trim().length === 0) return;
            void advance();
          }}
        >
          <input
            className="w-full rounded border px-3 py-2"
            value={grammarProduction}
            onChange={(event) => setGrammarProduction(event.target.value)}
            aria-label="Your sentence"
            data-testid="grammar-production"
          />
          <button
            type="submit"
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={grammarProduction.trim().length === 0}
            data-testid="grammar-continue"
          >
            Continue
          </button>
        </form>
      </section>
    );
  }

  if (step.kind === 'skill-practice') {
    if (step.slot === 'listening') {
      const clip: ListeningClip = { full: payload.listeningClip, segments: [] };
      return (
        <section className="flex flex-col gap-4" data-testid="step-skill-view">
          <h2 className="text-xl font-medium">Skill practice: listening</h2>
          <ListeningExercise
            clip={clip}
            submitting={evaluating}
            onSubmit={(response) => {
              setEvaluating(true);
              void evaluateListeningAction({
                clipText: payload.listeningClip.captionText,
                learnerResponse: response,
                level: payload.unit.level,
              }).then((outcome) => {
                setEvaluating(false);
                setListeningFeedback(
                  outcome.ok
                    ? outcome.evaluation.verdict.feedback
                    : 'The evaluation brain is not connected yet (' +
                        outcome.category +
                        '). Compare your answer with the captions above and continue.',
                );
              });
            }}
          />
          {listeningFeedback ? (
            <div className="flex flex-col gap-2">
              <p role="status" data-testid="listening-feedback">
                {listeningFeedback}
              </p>
              <button
                type="button"
                className="self-start rounded bg-blue-700 px-4 py-2 text-white"
                onClick={() => void advance()}
                data-testid="skill-continue"
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      );
    }
    // Non-listening slots practice the deterministic tile exercise until
    // their dedicated runners join the daily flow (scenario/reading need the
    // brain at runtime; Practice hosts their components).
    return (
      <section className="flex flex-col gap-4" data-testid="step-skill-view">
        <h2 className="text-xl font-medium">Skill practice: {step.slot} (tile drill)</h2>
        <p className="text-sm opacity-80">Build: {payload.tileItem.translation}</p>
        <div className="flex flex-wrap gap-2">
          {payload.tileItem.tiles
            .filter((tile) => !tileOrder.includes(tile))
            .map((tile) => (
              <button
                key={tile}
                type="button"
                className="rounded border px-3 py-1"
                onClick={() => setTileOrder([...tileOrder, tile])}
                data-testid={`tile-${tile}`}
              >
                {tile}
              </button>
            ))}
        </div>
        <p data-testid="tile-order">{tileOrder.join(' ')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-3 py-1"
            onClick={() => setTileOrder([])}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={tileOrder.length !== payload.tileItem.tiles.length}
            onClick={() => {
              const result = gradeTileOrder(payload.tileItem, tileOrder, new Date().toISOString());
              setTileFeedback(
                result.correct
                  ? 'Richtig! Verb second, just like that.'
                  : `Not quite: try "${result.acceptedExample.join(' ')}".`,
              );
            }}
            data-testid="tile-check"
          >
            Check
          </button>
        </div>
        {tileFeedback ? (
          <div className="flex flex-col gap-2">
            <p role="status" data-testid="tile-feedback">
              {tileFeedback}
            </p>
            <button
              type="button"
              className="self-start rounded bg-blue-700 px-4 py-2 text-white"
              onClick={() => void advance()}
              data-testid="skill-continue"
            >
              Continue
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="step-wrapup-view">
      <h2 className="text-xl font-medium">Wrap-up</h2>
      <label className="flex flex-col gap-1">
        <span>How confident are you with {payload.grammarItem.name}? (0 to 10)</span>
        <input
          type="number"
          min={0}
          max={10}
          value={grammarScore}
          onChange={(event) => setGrammarScore(Number(event.target.value))}
          className="w-24 rounded border px-3 py-2"
          data-testid="wrapup-grammar-score"
        />
      </label>
      <button
        type="button"
        className="self-start rounded bg-blue-700 px-4 py-2 text-white"
        onClick={() => void advance({ grammarScore })}
        data-testid="wrapup-finish"
      >
        Finish session
      </button>
    </section>
  );
}
