import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { FsrsCardPhase, FsrsCardState } from '@/lib/db/learner';

// Pure FSRS scheduling core (GT-104, Prime Directive 5): no I/O, every
// transition auditable from inputs. Fuzz stays disabled so scheduling is
// deterministic and testable. Persistence happens at the edges via the
// mapping functions below.

const scheduler = fsrs({ enable_fuzz: false });

export const REVIEW_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

const RATING_MAP: Readonly<Record<ReviewRating, Grade>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const PHASE_BY_STATE: Readonly<Record<State, FsrsCardPhase>> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STATE_BY_PHASE: Readonly<Record<FsrsCardPhase, State>> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function toFsrsCard(state: FsrsCardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learningSteps,
    state: STATE_BY_PHASE[state.phase],
    last_review: state.lastReview === null ? undefined : new Date(state.lastReview),
  };
}

export function fromFsrsCard(wordId: string, card: Card): FsrsCardState {
  return {
    wordId,
    phase: PHASE_BY_STATE[card.state],
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

// Introduction policy: a card enters FSRS on first exposure in a lesson,
// due immediately.
export function introduceCard(wordId: string, now: Date): FsrsCardState {
  return fromFsrsCard(wordId, createEmptyCard(now));
}

export function rate(state: FsrsCardState, rating: ReviewRating, now: Date): FsrsCardState {
  const { card } = scheduler.next(toFsrsCard(state), now, RATING_MAP[rating]);
  return fromFsrsCard(state.wordId, card);
}

export function isDue(state: FsrsCardState, now: Date): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}

// Rating flows address cards by wordId; an unknown id is a programming error
// and must fail loudly, never create a phantom card.
export function rateKnownCard(
  cardsByWordId: ReadonlyMap<string, FsrsCardState>,
  wordId: string,
  rating: ReviewRating,
  now: Date,
): FsrsCardState {
  const state = cardsByWordId.get(wordId);
  if (!state) {
    throw new Error(`Cannot rate unknown card "${wordId}"; introduce it first.`);
  }
  return rate(state, rating, now);
}
