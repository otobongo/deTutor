// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import { LearnFlow } from './learn-flow';

function word(id: string, german: string): VocabularyWord {
  return {
    id,
    german,
    wordType: 'other',
    article: null,
    translation: `${german}-en`,
    ipa: null,
    exampleDe: null,
    exampleEn: null,
    cefrLevel: 'A1',
    theme: 'foundations',
    picturable: false,
    frequencyRank: 100_001,
  };
}

const words = [word('w1', 'eins'), word('w2', 'zwei'), word('w3', 'drei')];

function speech(text: string): AudioAsset {
  return {
    clipId: `word-${text}`,
    source: { type: 'speech-synthesis', text, lang: 'de-DE' },
    captionsRequired: true,
    captionText: text,
  };
}

const loadAudio = (wordId: string) => Promise.resolve(speech(wordId));
const loadExtras = () => Promise.resolve(null);

afterEach(cleanup);

describe('learn flow', () => {
  it('starts at the first unlearned word, marks, and advances', async () => {
    const mark = vi.fn().mockResolvedValue(undefined);
    render(
      <LearnFlow
        groupTitle="Numbers"
        words={words}
        initiallyLearnedIds={['w1']}
        loadAudio={loadAudio}
        loadExtras={loadExtras}
        addToDeck={vi.fn()}
        mark={mark}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('focus-german').textContent).toBe('zwei'));
    expect(screen.getByTestId('learn-progress').textContent).toContain('1 of 3 learned');

    fireEvent.click(screen.getByTestId('learn-mark-next'));
    await waitFor(() => expect(screen.getByTestId('focus-german').textContent).toBe('drei'));
    expect(mark).toHaveBeenCalledWith('w2', true);
    expect(screen.getByTestId('learn-progress').textContent).toContain('2 of 3 learned');
  });

  it('finishing every word shows the graded summary', async () => {
    const mark = vi.fn().mockResolvedValue(undefined);
    render(
      <LearnFlow
        groupTitle="Numbers"
        words={words}
        initiallyLearnedIds={['w1', 'w2']}
        loadAudio={loadAudio}
        loadExtras={loadExtras}
        addToDeck={vi.fn()}
        mark={mark}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('focus-german').textContent).toBe('drei'));
    fireEvent.click(screen.getByTestId('learn-mark-next'));
    await waitFor(() => expect(screen.getByTestId('learn-flow-done')).toBeTruthy());
    expect(screen.getByTestId('learn-flow-done').textContent).toContain('3 of 3');
    expect(screen.getByTestId('learn-flow-done').textContent).toContain('grade A');
  });

  it('skip moves on without marking; a learned word offers unmark', async () => {
    const mark = vi.fn().mockResolvedValue(undefined);
    render(
      <LearnFlow
        groupTitle="Numbers"
        words={words}
        initiallyLearnedIds={[]}
        loadAudio={loadAudio}
        loadExtras={loadExtras}
        addToDeck={vi.fn()}
        mark={mark}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('focus-german').textContent).toBe('eins'));
    fireEvent.click(screen.getByTestId('learn-skip'));
    await waitFor(() => expect(screen.getByTestId('focus-german').textContent).toBe('zwei'));
    expect(mark).not.toHaveBeenCalled();
    expect(screen.queryByTestId('learn-unmark')).toBeNull();
  });
});
