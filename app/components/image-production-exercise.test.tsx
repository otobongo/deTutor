// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPlaceholderImageAsset } from '@/lib/media/placeholder-images';
import { ImageProductionExercise } from './image-production-exercise';

const image = buildPlaceholderImageAsset('der Tisch', 'render');

afterEach(cleanup);

describe('image production exercise (GT-203)', () => {
  it('shows the image alone and submits typed production', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ImageProductionExercise image={image} onSubmit={onSubmit} result={null} />);
    // Image only: no visible word options before submission.
    expect(screen.queryByRole('button', { name: /der Tisch/ })).toBeNull();
    await user.type(screen.getByTestId('image-production-input'), 'Tisch');
    await user.click(screen.getByTestId('image-production-submit'));
    expect(onSubmit).toHaveBeenCalledWith('Tisch');
  });

  it('renders the partial-credit feedback naming the correct article', () => {
    render(
      <ImageProductionExercise
        image={image}
        onSubmit={() => {}}
        result={{
          verdict: 'partial',
          rating: 'hard',
          correctLabel: 'der Tisch',
          logEntry: {
            category: 'gender',
            item: 'der Tisch',
            context: 'Image production: wrote "Tisch" for der Tisch',
            at: '2026-07-09T08:00:00.000Z',
          },
        }}
      />,
    );
    expect(screen.getByTestId('image-production-feedback').textContent).toContain('der Tisch');
    expect((screen.getByTestId('image-production-input') as HTMLInputElement).disabled).toBe(true);
  });
});
