import { describe, expect, it } from 'vitest';
import { buildWarmupQueue, dueCards, type WarmupItem } from './queue';
import { introduceCard, rate } from './scheduler';
import type { FsrsCardState } from '@/lib/db/learner';

const now = new Date('2026-07-09T08:00:00.000Z');

function cardDue(wordId: string, dueIso: string): FsrsCardState {
  return { ...introduceCard(wordId, now), due: dueIso };
}

describe('review queue (GT-105)', () => {
  it('does not surface a card due tomorrow', () => {
    const cards = [
      cardDue('due-now', '2026-07-09T08:00:00.000Z'),
      cardDue('due-tomorrow', '2026-07-10T08:00:00.000Z'),
    ];
    expect(dueCards(cards, now, 10).map((card) => card.wordId)).toEqual(['due-now']);
  });

  it('orders by overdueness, most overdue first, with a stable tie-break', () => {
    const cards = [
      cardDue('slightly-late', '2026-07-09T07:00:00.000Z'),
      cardDue('very-late', '2026-07-05T08:00:00.000Z'),
      cardDue('tie-b', '2026-07-09T06:00:00.000Z'),
      cardDue('tie-a', '2026-07-09T06:00:00.000Z'),
    ];
    expect(dueCards(cards, now, 10).map((card) => card.wordId)).toEqual([
      'very-late',
      'tie-a',
      'tie-b',
      'slightly-late',
    ]);
  });

  it('respects the queue limit after ordering', () => {
    const cards = [
      cardDue('a', '2026-07-08T08:00:00.000Z'),
      cardDue('b', '2026-07-07T08:00:00.000Z'),
      cardDue('c', '2026-07-06T08:00:00.000Z'),
    ];
    expect(dueCards(cards, now, 2).map((card) => card.wordId)).toEqual(['c', 'b']);
  });

  it('injects extras without disturbing the FSRS ratings of real cards', () => {
    const cards = [cardDue('tisch-noun', '2026-07-08T08:00:00.000Z')];
    const inject = (items: readonly WarmupItem[]): readonly WarmupItem[] => [
      items[0] as WarmupItem,
      { kind: 'retest', retestId: 'retest-1', unitId: 'a1-1' },
    ];
    const queue = buildWarmupQueue(cards, now, 10, inject);
    expect(queue).toHaveLength(2);
    expect(queue[1]).toEqual({ kind: 'retest', retestId: 'retest-1', unitId: 'a1-1' });

    // Rating the real card is unaffected by the injected item's presence.
    const withExtra = queue[0];
    expect(withExtra?.kind).toBe('review');
    if (withExtra?.kind === 'review') {
      const rated = rate(withExtra.card, 'good', now);
      expect(rated).toEqual(rate(cards[0] as FsrsCardState, 'good', now));
    }
  });

  it('defaults to a no-op injection seam', () => {
    const cards = [cardDue('tisch-noun', '2026-07-08T08:00:00.000Z')];
    const queue = buildWarmupQueue(cards, now, 10);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.kind).toBe('review');
  });
});
