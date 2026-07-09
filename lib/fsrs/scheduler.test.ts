import { describe, expect, it } from 'vitest';
import { fsrsCardStateSchema } from '@/lib/db/learner';
import { fromFsrsCard, introduceCard, isDue, rate, rateKnownCard, toFsrsCard } from './scheduler';

const now = new Date('2026-07-09T08:00:00.000Z');

function daysLater(days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

function matured() {
  // Drive a fresh card into review state with consecutive Good ratings.
  let state = introduceCard('tisch-noun', now);
  let at = now;
  for (let step = 0; step < 4 && state.phase !== 'review'; step += 1) {
    state = rate(state, 'good', at);
    at = new Date(state.due);
  }
  return { state, at };
}

describe('FSRS scheduler (GT-104)', () => {
  it('introduces cards due immediately in the new phase', () => {
    const card = introduceCard('tisch-noun', now);
    expect(card.phase).toBe('new');
    expect(isDue(card, now)).toBe(true);
    expect(fsrsCardStateSchema.safeParse(card).success).toBe(true);
  });

  it('Good rating extends the interval; Again resets to (re)learning', () => {
    const { state: reviewCard, at } = matured();
    expect(reviewCard.phase).toBe('review');
    expect(reviewCard.scheduledDays).toBeGreaterThanOrEqual(1);

    const afterGood = rate(reviewCard, 'good', daysLater(reviewCard.scheduledDays));
    expect(afterGood.scheduledDays).toBeGreaterThan(reviewCard.scheduledDays);

    const afterAgain = rate(reviewCard, 'again', at);
    expect(afterAgain.phase).toBe('relearning');
    expect(afterAgain.lapses).toBe(reviewCard.lapses + 1);
    expect(afterAgain.scheduledDays).toBeLessThan(reviewCard.scheduledDays);
  });

  it('orders intervals Again < Hard < Good <= Easy from a review card', () => {
    const { state: reviewCard } = matured();
    const ratingDate = daysLater(reviewCard.scheduledDays);
    const due = (rating: 'again' | 'hard' | 'good' | 'easy') =>
      new Date(rate(reviewCard, rating, ratingDate).due).getTime();
    expect(due('again')).toBeLessThan(due('hard'));
    expect(due('hard')).toBeLessThan(due('good'));
    expect(due('good')).toBeLessThanOrEqual(due('easy'));
  });

  it('round-trip persistence preserves scheduler behavior exactly', () => {
    const { state: reviewCard } = matured();
    const roundTripped = fromFsrsCard(reviewCard.wordId, toFsrsCard(reviewCard));
    expect(roundTripped).toEqual(reviewCard);
    const ratingDate = daysLater(1);
    expect(rate(roundTripped, 'good', ratingDate)).toEqual(rate(reviewCard, 'good', ratingDate));
  });

  it('is deterministic: same card, rating, and time always agree', () => {
    const card = introduceCard('haus-noun', now);
    expect(rate(card, 'good', now)).toEqual(rate(card, 'good', now));
  });

  it('rating an unknown card id fails loudly', () => {
    const cards = new Map([['tisch-noun', introduceCard('tisch-noun', now)]]);
    expect(() => rateKnownCard(cards, 'phantom-word', 'good', now)).toThrow(
      /unknown card "phantom-word"/,
    );
    expect(rateKnownCard(cards, 'tisch-noun', 'good', now).reps).toBe(1);
  });

  it('keeps every transition inside the persistable schema', () => {
    let state = introduceCard('katze-noun', now);
    for (const rating of ['good', 'again', 'hard', 'easy', 'good'] as const) {
      state = rate(state, rating, new Date(state.due));
      expect(fsrsCardStateSchema.safeParse(state).success).toBe(true);
    }
  });
});
