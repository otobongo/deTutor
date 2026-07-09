// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioAsset } from '@/lib/media/provider';
import { ListeningExercise, type ListeningClip } from './listening-exercise';

function silentAsset(clipId: string): AudioAsset {
  return {
    clipId,
    source: { type: 'silent' },
    captionsRequired: true,
    captionText: 'Der Zug nach München fällt heute aus.',
  };
}

const clip: ListeningClip = {
  full: silentAsset('a1-listen-01'),
  segments: [silentAsset('a1-listen-01-s1'), silentAsset('a1-listen-01-s2')],
};

afterEach(cleanup);

describe('listening exercise flow (GT-205)', () => {
  it('renders captions for placeholder silent audio after playing', async () => {
    const user = userEvent.setup();
    render(<ListeningExercise clip={clip} onSubmit={() => {}} submitting={false} />);
    expect(screen.queryByTestId('listening-captions')).toBeNull();
    await user.click(screen.getByTestId('listening-play-a1-listen-01'));
    expect(screen.getByTestId('listening-captions').textContent).toContain('München');
  });

  it('replay targets the same clip id and segments have their own controls', async () => {
    const user = userEvent.setup();
    render(<ListeningExercise clip={clip} onSubmit={() => {}} submitting={false} />);
    const play = screen.getByTestId('listening-play-a1-listen-01');
    await user.click(play);
    // Same button, same clipId: replay never requests a different asset.
    expect(play.textContent).toBe('Replay');
    expect(screen.getByTestId('listening-segment-a1-listen-01-s1')).toBeTruthy();
    expect(screen.getByTestId('listening-segment-a1-listen-01-s2')).toBeTruthy();
    expect(screen.getByTestId('listening-slower')).toBeTruthy();
  });

  it('submits the learner description to evaluation', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ListeningExercise clip={clip} onSubmit={onSubmit} submitting={false} />);
    expect((screen.getByTestId('listening-submit') as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByTestId('listening-response'), 'The train to Munich is cancelled');
    await user.click(screen.getByTestId('listening-submit'));
    expect(onSubmit).toHaveBeenCalledWith('The train to Munich is cancelled');
  });
});
