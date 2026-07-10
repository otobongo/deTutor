// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
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

afterEach(cleanup);

describe('interactive warm-up review', () => {
  it('hides the answer until revealed, then offers the four FSRS ratings', () => {
    render(<WarmupReview words={words} onRate={vi.fn()} onDone={vi.fn()} />);
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
    render(<WarmupReview words={words} onRate={onRate} onDone={onDone} />);

    fireEvent.click(screen.getByTestId('warmup-reveal'));
    fireEvent.click(screen.getByTestId('warmup-rate-good'));
    await waitFor(() => expect(screen.getByTestId('warmup-front').textContent).toContain('Brot'));
    expect(onRate).toHaveBeenCalledWith('hund-noun', 'good');

    fireEvent.click(screen.getByTestId('warmup-reveal'));
    fireEvent.click(screen.getByTestId('warmup-rate-again'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['good', 'again']));
    expect(onRate).toHaveBeenCalledWith('brot-noun', 'again');
  });
});
