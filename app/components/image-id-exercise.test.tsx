// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPlaceholderImageAsset } from '@/lib/media/placeholder-images';
import type { RecognitionExercise } from '@/lib/exercises/image-id';
import { ImageIdExercise } from './image-id-exercise';

const exercise: RecognitionExercise = {
  targetWordId: 'tisch-noun',
  imageWord: 'der Tisch',
  options: [
    { wordId: 'lampe-noun', label: 'die Lampe', kind: 'distractor' },
    { wordId: 'tisch-noun', label: 'der Tisch', kind: 'target' },
    { wordId: 'tisch-noun#article-trap', label: 'die Tisch', kind: 'article-trap' },
  ],
};

afterEach(cleanup);

describe('image identification exercise (GT-202)', () => {
  it('renders the adapter-served placeholder image and all options', () => {
    render(
      <ImageIdExercise
        exercise={exercise}
        image={buildPlaceholderImageAsset('der Tisch', 'flat')}
        onChoose={() => {}}
        result={null}
      />,
    );
    expect(screen.getByTestId('image-id-image').innerHTML).toContain('<svg');
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('reports the chosen option and shows warm feedback on the result', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { rerender } = render(
      <ImageIdExercise
        exercise={exercise}
        image={buildPlaceholderImageAsset('der Tisch', 'flat')}
        onChoose={onChoose}
        result={null}
      />,
    );
    await user.click(screen.getByTestId('image-id-option-tisch-noun'));
    expect(onChoose).toHaveBeenCalledWith('tisch-noun');

    rerender(
      <ImageIdExercise
        exercise={exercise}
        image={buildPlaceholderImageAsset('der Tisch', 'flat')}
        onChoose={onChoose}
        result={{ correct: false, correctLabel: 'der Tisch', logEntry: null }}
      />,
    );
    expect(screen.getByTestId('image-id-feedback').textContent).toContain('der Tisch');
  });
});
