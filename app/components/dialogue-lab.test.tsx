// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogueLabPayload } from '@/app/actions/dialogue';
import { DialogueLab } from './dialogue-lab';

function payload(captionsRequired: boolean): DialogueLabPayload {
  return {
    source: 'fallback',
    dialogue: {
      title: 'Im Café',
      turns: [
        { speaker: 'Anna', text: 'Was möchtest du trinken?' },
        { speaker: 'Ben', text: 'Einen Kaffee, bitte.' },
        { speaker: 'Anna', text: 'Ich trinke einen Tee.' },
        { speaker: 'Ben', text: 'Möchtest du ein Brot?' },
        { speaker: 'Anna', text: 'Ja, gern.' },
        { speaker: 'Ben', text: 'Gut, zwei Brote bitte.' },
      ],
    },
    audio: {
      clipId: 'dialogue-x',
      source: captionsRequired
        ? { type: 'speech-synthesis', text: 'x', lang: 'de-DE' }
        : { type: 'url', url: '/media/audio/dialogue-x.wav' },
      captionsRequired,
      captionText: 'x',
    },
    identification: [
      { wordId: 'brot-noun', label: 'das Brot', heard: true },
      { wordId: 'hund-noun', label: 'der Hund', heard: false },
      { wordId: 'kaffee-noun', label: 'der Kaffee', heard: true },
    ],
  };
}

afterEach(cleanup);

describe('dialogue lab', () => {
  it('hides the transcript for real audio until the final phase, then scores the run', async () => {
    const recordScore = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(
      <DialogueLab
        load={() => Promise.resolve(payload(false))}
        evaluate={() =>
          Promise.resolve({
            ok: true,
            evaluation: {
              verdict: { verdict: 'full', missedPoints: [], feedback: 'Genau richtig!' },
              nuance: null,
            },
          })
        }
        recordScore={recordScore}
        onDone={onDone}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dialogue-lab')).toBeTruthy());
    expect(screen.queryByTestId('dialogue-transcript')).toBeNull();

    fireEvent.click(screen.getByTestId('dialogue-to-identify'));
    fireEvent.click(screen.getByTestId('identify-brot-noun'));
    fireEvent.click(screen.getByTestId('identify-kaffee-noun'));
    fireEvent.click(screen.getByTestId('identify-check'));
    expect(screen.getByTestId('identify-score').textContent).toContain('3 of 3');

    fireEvent.click(screen.getByTestId('dialogue-to-explain'));
    fireEvent.change(screen.getByTestId('explain-input'), {
      target: { value: 'They order coffee and bread in a cafe.' },
    });
    fireEvent.click(screen.getByTestId('explain-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('explain-feedback').textContent).toContain('Genau richtig!'),
    );

    fireEvent.click(screen.getByTestId('dialogue-to-transcript'));
    expect(screen.getByTestId('dialogue-transcript')).toBeTruthy();
    fireEvent.click(screen.getByTestId('skill-continue'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100));
    expect(recordScore).toHaveBeenCalledWith(100);
  });

  it('captioned placeholder audio keeps the transcript visible (GT-007 contract)', async () => {
    render(
      <DialogueLab
        load={() => Promise.resolve(payload(true))}
        evaluate={vi.fn()}
        recordScore={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dialogue-transcript')).toBeTruthy());
  });

  it('a brain outage during explanation stays recoverable', async () => {
    render(
      <DialogueLab
        load={() => Promise.resolve(payload(false))}
        evaluate={() => Promise.resolve({ ok: false, category: 'network' })}
        recordScore={vi.fn().mockResolvedValue(undefined)}
        onDone={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dialogue-lab')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dialogue-to-identify'));
    fireEvent.click(screen.getByTestId('identify-check'));
    fireEvent.click(screen.getByTestId('dialogue-to-explain'));
    fireEvent.change(screen.getByTestId('explain-input'), { target: { value: 'No idea.' } });
    fireEvent.click(screen.getByTestId('explain-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('explain-feedback').textContent).toContain('not reachable'),
    );
    expect(screen.getByTestId('dialogue-to-transcript')).toBeTruthy();
  });
});
