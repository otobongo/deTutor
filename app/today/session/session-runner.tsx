'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GrammarErrorCategory, LessonSession } from '@/lib/db/learner';
import { completeStep, currentStep } from '@/lib/lesson/engine';
import { gradeTileOrder } from '@/lib/exercises/word-tiles';
import { gradeRecognition, type RecognitionResult } from '@/lib/exercises/image-id';
import { gradeDictation, type DictationResult } from '@/lib/exercises/dictation';
import type { ReviewRating } from '@/lib/fsrs/scheduler';
import { DialogueLab } from '@/app/components/dialogue-lab';
import { WordWorkspace } from '@/app/components/word-workspace';
import { VocabCard } from '@/app/components/vocab-card';
import { WarmupReview } from '@/app/components/warmup-review';
import { ReadingPanel } from '@/app/components/reading-panel';
import { ScenarioChat } from '@/app/components/scenario-chat';
import { ImageIdExercise } from '@/app/components/image-id-exercise';
import { DictationExercise } from '@/app/components/dictation-exercise';
import {
  completeSession,
  evaluateListeningAction,
  saveSession,
  type TodaySessionPayload,
} from '@/app/actions/lesson';
import { introduceWordsAction, rateCardAction } from '@/app/actions/cards';
import { logGrammarErrorsAction } from '@/app/actions/grammar';
import {
  getReadingExerciseAction,
  submitReadingAction,
  tapWordAction,
} from '@/app/actions/reading';
import {
  endScenarioAction,
  getScenarioForTodayAction,
  scenarioTurnAction,
} from '@/app/actions/scenario';
import { getWordExtrasAction } from '@/app/actions/vocab';
import { getDialogueLabAction, recordListeningScoreAction } from '@/app/actions/dialogue';
import { getWordAudioAction } from '@/app/actions/learn';

// The daily session runner (GT-220): walks the five GT-108 steps in order,
// persisting after each so an interrupted session resumes at its step. Every
// skill slot runs its real exercise; brain-dependent evaluation renders
// failures as recoverable states. Warm-up ratings, image-ID results, logged
// error counts, and the scenario score all flow into the GT-219 report.

export function SessionRunner({ payload }: { payload: TodaySessionPayload }) {
  const router = useRouter();
  const [session, setSession] = useState<LessonSession>(payload.session);
  const [echoIndex, setEchoIndex] = useState(0);
  const [imageIdIndex, setImageIdIndex] = useState(0);
  const [imageIdResult, setImageIdResult] = useState<RecognitionResult | null>(null);
  const [imageIdResults, setImageIdResults] = useState<readonly boolean[]>([]);
  const [warmupRatings, setWarmupRatings] = useState<readonly ReviewRating[]>([]);
  const [grammarProduction, setGrammarProduction] = useState('');
  const [tileOrder, setTileOrder] = useState<string[]>([]);
  const [tileFeedback, setTileFeedback] = useState<string | null>(null);
  const [writingStage, setWritingStage] = useState<'tiles' | 'dictation'>('tiles');
  const [dictationResult, setDictationResult] = useState<DictationResult | null>(null);
  const [listeningScore, setListeningScore] = useState<number | null>(null);
  const [readingScore, setReadingScore] = useState<number | null>(null);
  const [scenarioScore, setScenarioScore] = useState<number | null>(null);
  const [errorTally, setErrorTally] = useState<Partial<Record<GrammarErrorCategory, number>>>({});
  const [grammarScore, setGrammarScore] = useState(7);
  const [done, setDone] = useState(false);

  const step = currentStep(session);
  const echoWords = payload.dayWords.slice(0, 3);

  function tallyErrors(categories: readonly GrammarErrorCategory[]): void {
    if (categories.length === 0) return;
    setErrorTally((current) => {
      const next = { ...current };
      for (const category of categories) next[category] = (next[category] ?? 0) + 1;
      return next;
    });
  }

  async function advance(extra?: {
    grammarScore?: number;
    ratings?: readonly ReviewRating[];
    scenarioScore?: number | null;
  }): Promise<void> {
    const next = completeStep(session, {
      learnerProduced: true,
      grammarScore: extra?.grammarScore,
    });
    setSession(next);
    if (next.status === 'completed') {
      await completeSession({
        session: next,
        warmupRatings: [...(extra?.ratings ?? warmupRatings)],
        imageIdResults: [...imageIdResults],
        scenarioScore: extra?.scenarioScore !== undefined ? extra.scenarioScore : scenarioScore,
        skillScores: {
          ...(readingScore === null ? {} : { reading: readingScore }),
          ...(listeningScore === null ? {} : { listening: listeningScore }),
        },
        errorsByCategory: errorTally,
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
          {warmupRatings.length > 0 ? ` Cards reviewed: ${warmupRatings.length}.` : ''} Tomorrow
          rotates to the next skill.
        </p>
        <button
          type="button"
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
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
        {payload.warmupWords.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p>No review cards due yet; they start accumulating from today&apos;s new words.</p>
            <button
              type="button"
              className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
              onClick={() => void advance()}
              data-testid="warmup-continue"
            >
              Continue
            </button>
          </div>
        ) : (
          <WarmupReview
            words={payload.warmupWords}
            onRate={async (wordId, rating) => {
              await rateCardAction(wordId, rating);
            }}
            onDone={(ratings) => {
              setWarmupRatings(ratings);
              void advance({ ratings });
            }}
          />
        )}
      </section>
    );
  }

  if (step.kind === 'new-vocabulary') {
    const word = echoWords[echoIndex];
    const imageItem = payload.imageId[imageIdIndex];
    return (
      <section className="flex flex-col gap-4" data-testid="step-vocab-view">
        {/* One template string: this Next version's JSX compiler drops the
            space between an expression and a following word. */}
        <h2 className="text-xl font-medium">
          {`New vocabulary: ${step.theme} (${Math.min(echoIndex + 1, echoWords.length)} of ${echoWords.length} echoed, ${payload.dayWords.length} in today's set)`}
        </h2>
        {word && payload.wordAudio[word.id] ? (
          <WordWorkspace
            key={word.id}
            word={word}
            audio={payload.wordAudio[word.id]!}
            loadExtras={getWordExtrasAction}
            addToDeck={introduceWordsAction}
            loadNeighborAudio={getWordAudioAction}
            onEchoDone={() => setEchoIndex((index) => index + 1)}
          />
        ) : imageItem ? (
          <div className="flex flex-col gap-3" data-testid="vocab-image-id">
            <p className="text-sm text-ink-muted">
              Which word matches the picture? ({imageIdIndex + 1} of {payload.imageId.length})
            </p>
            <ImageIdExercise
              key={imageItem.word.id}
              exercise={imageItem.exercise}
              image={imageItem.image}
              result={imageIdResult}
              onChoose={(chosenWordId) => {
                const result = gradeRecognition(
                  imageItem.exercise,
                  imageItem.word,
                  chosenWordId,
                  new Date().toISOString(),
                );
                setImageIdResult(result);
                setImageIdResults((current) => [...current, result.correct]);
                if (result.logEntry) {
                  tallyErrors([result.logEntry.category]);
                  void logGrammarErrorsAction([result.logEntry]);
                }
              }}
            />
            {imageIdResult ? (
              <button
                type="button"
                className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
                onClick={() => {
                  setImageIdResult(null);
                  setImageIdIndex((index) => index + 1);
                }}
                data-testid="image-id-next"
              >
                Continue
              </button>
            ) : null}
          </div>
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
              className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
              onClick={() => {
                // Today's words enter FSRS now, due immediately, so the next
                // warm-up reviews them (GT-104 introduction policy).
                void introduceWordsAction(payload.dayWords.map((dayWord) => dayWord.id)).then(() =>
                  advance(),
                );
              }}
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
        <p className="text-sm text-ink-muted">
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
            className="w-full rounded-md border bg-surface px-3 py-2"
            value={grammarProduction}
            onChange={(event) => setGrammarProduction(event.target.value)}
            aria-label="Your sentence"
            data-testid="grammar-production"
          />
          <button
            type="submit"
            className="rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
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
      return (
        <section className="flex flex-col gap-4" data-testid="step-skill-view">
          <h2 className="text-xl font-medium">Skill practice: listening</h2>
          <DialogueLab
            load={getDialogueLabAction}
            evaluate={evaluateListeningAction}
            recordScore={recordListeningScoreAction}
            onDone={(score) => {
              setListeningScore(score);
              void advance();
            }}
          />
        </section>
      );
    }

    if (step.slot === 'reading') {
      return (
        <section className="flex flex-col gap-4" data-testid="step-skill-view">
          <h2 className="text-xl font-medium">Skill practice: reading</h2>
          <ReadingPanel
            load={getReadingExerciseAction}
            tap={tapWordAction}
            submit={submitReadingAction}
            onDone={(score) => {
              setReadingScore(score);
              void advance();
            }}
          />
        </section>
      );
    }

    if (step.slot === 'scenario') {
      return (
        <section className="flex flex-col gap-4" data-testid="step-skill-view">
          <h2 className="text-xl font-medium">Skill practice: scenario</h2>
          <ScenarioChat
            start={getScenarioForTodayAction}
            turn={scenarioTurnAction}
            end={endScenarioAction}
            onDone={(score) => {
              setScenarioScore(score);
              void advance({ scenarioScore: score });
            }}
          />
        </section>
      );
    }

    // Writing slot, A1 progression (PRD 4.6): word tiles first, then a
    // dictation round from a day word's example sentence.
    if (writingStage === 'dictation' && payload.dictation) {
      return (
        <section className="flex flex-col gap-4" data-testid="step-skill-view">
          <h2 className="text-xl font-medium">Skill practice: writing (dictation)</h2>
          <DictationExercise
            audio={payload.dictation.audio}
            result={dictationResult}
            onSubmit={(submitted) => {
              const result = gradeDictation(
                payload.dictation!.text,
                submitted,
                new Date().toISOString(),
              );
              setDictationResult(result);
              if (result.logEntries.length > 0) {
                tallyErrors(result.logEntries.map((entry) => entry.category));
                void logGrammarErrorsAction([...result.logEntries]);
              }
            }}
          />
          {dictationResult ? (
            <button
              type="button"
              className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
              onClick={() => void advance()}
              data-testid="skill-continue"
            >
              Continue
            </button>
          ) : null}
        </section>
      );
    }

    return (
      <section className="flex flex-col gap-4" data-testid="step-skill-view">
        <h2 className="text-xl font-medium">Skill practice: writing (word tiles)</h2>
        <p className="text-sm text-ink-muted">Build: {payload.tileItem.translation}</p>
        <div className="flex flex-wrap gap-2" data-testid="tile-tray">
          {payload.tileItem.tiles
            .filter((tile) => !tileOrder.includes(tile))
            .map((tile) => (
              <button
                key={tile}
                type="button"
                className="rounded-md border bg-surface px-3 py-1"
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
            className="rounded-md border bg-surface px-3 py-1"
            onClick={() => setTileOrder([])}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
            disabled={tileOrder.length !== payload.tileItem.tiles.length}
            onClick={() => {
              const result = gradeTileOrder(payload.tileItem, tileOrder, new Date().toISOString());
              setTileFeedback(
                result.correct
                  ? 'Richtig! Verb second, just like that.'
                  : `Not quite: try "${result.acceptedExample.join(' ')}".`,
              );
              if (result.logEntry) {
                tallyErrors([result.logEntry.category]);
                void logGrammarErrorsAction([result.logEntry]);
              }
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
            {payload.dictation ? (
              <button
                type="button"
                className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
                onClick={() => setWritingStage('dictation')}
                data-testid="writing-to-dictation"
              >
                Next: dictation
              </button>
            ) : (
              <button
                type="button"
                className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
                onClick={() => void advance()}
                data-testid="skill-continue"
              >
                Continue
              </button>
            )}
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
          className="w-24 rounded-md border bg-surface px-3 py-2"
          data-testid="wrapup-grammar-score"
        />
      </label>
      <button
        type="button"
        className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
        onClick={() => void advance({ grammarScore })}
        data-testid="wrapup-finish"
      >
        Finish session
      </button>
    </section>
  );
}
