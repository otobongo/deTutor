// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadingExercisePayload, TapOutcome } from '@/app/actions/reading';
import { ReadingPanel } from './reading-panel';

const exercise: ReadingExercisePayload = {
  source: 'fallback',
  title: 'Ein Zettel',
  text: 'Das Brot ist in der Küche.',
  task: {
    format: 'richtig-falsch',
    text: 'Das Brot ist in der Küche.',
    items: [
      { statement: 'Das Brot ist in der Küche.', answer: true },
      { statement: 'Das Brot ist im Bad.', answer: false },
    ],
  },
};

const corpusTap: TapOutcome = {
  kind: 'corpus',
  word: {
    id: 'brot-noun',
    german: 'Brot',
    wordType: 'noun',
    article: 'das',
    translation: 'bread',
    ipa: null,
    exampleDe: null,
    exampleEn: null,
    cefrLevel: 'A1',
    theme: 'food-drink',
    picturable: true,
    frequencyRank: 305,
  },
  added: true,
};

afterEach(cleanup);

describe('reading panel', () => {
  it('renders the loaded text word by word and answers score through the callback', async () => {
    const submit = vi.fn().mockResolvedValue({ correct: 2, total: 2, score: 100 });
    const onDone = vi.fn();
    render(
      <ReadingPanel
        load={() => Promise.resolve(exercise)}
        tap={() => Promise.resolve(corpusTap)}
        submit={submit}
        onDone={onDone}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('reading-panel')).toBeTruthy());

    fireEvent.click(screen.getByTestId('reading-answer-0-richtig'));
    fireEvent.click(screen.getByTestId('reading-answer-1-falsch'));
    fireEvent.click(screen.getByTestId('reading-submit'));

    await waitFor(() => expect(screen.getByTestId('reading-score').textContent).toContain('100'));
    expect(submit).toHaveBeenCalledWith(exercise.task, [true, false]);

    fireEvent.click(screen.getByTestId('skill-continue'));
    expect(onDone).toHaveBeenCalledWith(100);
  });

  it('tapping a word shows its card essentials and deck status', async () => {
    const tap = vi.fn().mockResolvedValue(corpusTap);
    render(
      <ReadingPanel
        load={() => Promise.resolve(exercise)}
        tap={tap}
        submit={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('reading-panel')).toBeTruthy());

    fireEvent.click(screen.getByTestId('reading-word-2'));
    await waitFor(() => expect(screen.getByTestId('tap-result').textContent).toContain('bread'));
    expect(screen.getByTestId('tap-result').textContent).toContain('Added to your deck');
    expect(tap).toHaveBeenCalledWith('Brot');
  });

  it('a missing exercise stays walkable with an explicit continue', async () => {
    const onDone = vi.fn();
    render(
      <ReadingPanel
        load={() => Promise.resolve(null)}
        tap={vi.fn()}
        submit={vi.fn()}
        onDone={onDone}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('reading-skip')).toBeTruthy());
    fireEvent.click(screen.getByTestId('reading-skip'));
    expect(onDone).toHaveBeenCalledWith(null);
  });
});
