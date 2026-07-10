// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { WarmupDisplayItem } from '@/app/actions/lesson';
import { WarmupReview } from './warmup-review';

const words: VocabularyWord[] = [
  {
    id: 'hund-noun',
    german: 'Hund',
    wordType: 'noun',
    article: 'der',
    translation: 'dog',
    ipa: 'hʊnt',
    exampleDe: 'Der Hund ist klein.',
    exampleEn: 'The dog is small.',
    cefrLevel: 'A1',
    theme: 'nature-weather',
    picturable: true,
    frequencyRank: 210,
  },
  {
    id: 'brot-noun',
    german: 'Brot',
    wordType: 'noun',
    article: 'das',
    translation: 'bread',
    ipa: 'broːt',
    exampleDe: 'Das Brot ist frisch.',
    exampleEn: 'The bread is fresh.',
    cefrLevel: 'A1',
    theme: 'food-drink',
    picturable: true,
    frequencyRank: 305,
  },
];

const items: WarmupDisplayItem[] = [
  { kind: 'review', word: words[0]! },
  { kind: 'retest', word: words[1]!, retestId: 'retest-a1-1-d7', unitId: 'a1-1' },
];

afterEach(cleanup);

describe('interactive warm-up review', () => {
  it('hides the answer until revealed, then offers the four FSRS ratings', () => {
    render(<WarmupReview items={items} onRate={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByTestId('warmup-front').textContent).toContain('Hund');
    expect(screen.queryByTestId('warmup-back')).toBeNull();
    expect(screen.queryByTestId('warmup-rate-good')).toBeNull();

    fireEvent.click(screen.getByTestId('warmup-reveal'));
    expect(screen.getByTestId('warmup-back').textContent).toContain('dog');
    for (const rating of ['again', 'hard', 'good', 'easy']) {
      expect(screen.getByTestId(`warmup-rate-${rating}`)).toBeTruthy();
    }
  });

  it('rates each card, advances, and reports all ratings on completion', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(<WarmupReview items={items} onRate={onRate} onDone={onDone} />);

    fireEvent.click(screen.getByTestId('warmup-reveal'));
    fireEvent.click(screen.getByTestId('warmup-rate-good'));
    await waitFor(() => expect(screen.getByTestId('warmup-front').textContent).toContain('Brot'));
    expect(onRate).toHaveBeenCalledWith(items[0], 'good');

    fireEvent.click(screen.getByTestId('warmup-reveal'));
    fireEvent.click(screen.getByTestId('warmup-rate-again'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['good', 'again']));
    // The disguised retest rates through the same surface, item and all.
    expect(onRate).toHaveBeenCalledWith(items[1], 'again');
  });
});
