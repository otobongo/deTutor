// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioAsset } from '@/lib/media/provider';
import { gradeDictation } from '@/lib/exercises/dictation';
import { DictationExercise } from './dictation-exercise';

const audio: AudioAsset = {
  clipId: 'a1-dictation-01',
  source: { type: 'silent' },
  captionsRequired: true,
  captionText: 'Wir fahren am Samstag nach Hamburg.',
};

afterEach(cleanup);

describe('dictation exercise (GT-211)', () => {
  it('never shows captions before submission, shows them after', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DictationExercise audio={audio} onSubmit={() => {}} result={null} />,
    );
    await user.click(screen.getByTestId('dictation-play-a1-dictation-01'));
    expect(screen.queryByTestId('dictation-captions')).toBeNull();

    rerender(
      <DictationExercise
        audio={audio}
        onSubmit={() => {}}
        result={gradeDictation(
          audio.captionText,
          'Wir fahren am Samstag nach Hamburg',
          '2026-07-09T08:00:00.000Z',
        )}
      />,
    );
    expect(screen.getByTestId('dictation-captions').textContent).toContain('Hamburg');
  });

  it('submits the attempt and renders the word-level diff', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <DictationExercise audio={audio} onSubmit={onSubmit} result={null} />,
    );
    await user.type(screen.getByTestId('dictation-input'), 'Wir fahren am Samstag nach Homburg');
    await user.click(screen.getByTestId('dictation-submit'));
    expect(onSubmit).toHaveBeenCalledWith('Wir fahren am Samstag nach Homburg');

    rerender(
      <DictationExercise
        audio={audio}
        onSubmit={onSubmit}
        result={gradeDictation(
          audio.captionText,
          'Wir fahren am Samstag nach Homburg',
          '2026-07-09T08:00:00.000Z',
        )}
      />,
    );
    const diff = screen.getByTestId('dictation-diff');
    expect(diff.querySelectorAll('[data-diff="wrong"]').length).toBe(1);
  });
});
