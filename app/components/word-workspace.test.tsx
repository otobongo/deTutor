// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { WordExtrasPayload } from '@/app/actions/vocab';
import { WordWorkspace } from './word-workspace';

const karte: VocabularyWord = {
  id: 'karte-noun',
  german: 'Karte',
  wordType: 'noun',
  article: 'die',
  translation: 'card, map',
  ipa: 'ˈkartə',
  exampleDe: 'Die Karte ist neu.',
  exampleEn: 'The card is new.',
  cefrLevel: 'A1',
  theme: 'city-transport',
  picturable: true,
  frequencyRank: 100,
};

const fahrkarte: VocabularyWord = {
  ...karte,
  id: 'fahrkarte-noun',
  german: 'Fahrkarte',
  translation: 'train ticket',
  exampleDe: null,
};

function speech(text: string): AudioAsset {
  return {
    clipId: `clip-${text}`,
    source: { type: 'speech-synthesis', text, lang: 'de-DE' },
    captionsRequired: true,
    captionText: text,
  };
}

const extras: WordExtrasPayload = {
  note: { text: 'Karte can be a card or a map, context decides.', audio: speech('note') },
  senses: ['card', 'map'],
  example: { text: 'Die Karte ist neu.', audio: speech('example') },
  related: [{ word: fahrkarte, relation: 'family' }],
};

afterEach(cleanup);

describe('word workspace', () => {
  it('shows focus, context, senses, and neighborhood zones once extras load', async () => {
    render(
      <WordWorkspace
        word={karte}
        audio={speech('die Karte')}
        loadExtras={() => Promise.resolve(extras)}
        addToDeck={vi.fn().mockResolvedValue(1)}
        onEchoDone={vi.fn()}
      />,
    );
    expect(screen.getByTestId('focus-german').textContent).toBe('Karte');
    expect(screen.getByTestId('focus-article').textContent?.trim()).toBe('die');
    expect(screen.getByTestId('focus-translation').textContent).toBe('card, map');

    await waitFor(() => expect(screen.getByTestId('context-note')).toBeTruthy());
    expect(screen.getByTestId('focus-senses').textContent).toContain('card · map');
    expect(screen.getByTestId('context-example').textContent).toContain('Die Karte ist neu.');
    expect(screen.getByTestId('word-neighborhood')).toBeTruthy();
    // The echo flow still gates production.
    expect(screen.getByTestId('echo-heard')).toBeTruthy();
  });

  it('tapping a neighbor shows its card essentials and adds it to the deck once', async () => {
    const addToDeck = vi.fn().mockResolvedValue(1);
    render(
      <WordWorkspace
        word={karte}
        audio={speech('die Karte')}
        loadExtras={() => Promise.resolve(extras)}
        addToDeck={addToDeck}
        onEchoDone={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('related-fahrkarte-noun')).toBeTruthy());

    fireEvent.click(screen.getByTestId('related-fahrkarte-noun'));
    await waitFor(() =>
      expect(screen.getByTestId('related-detail').textContent).toContain('train ticket'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('related-detail').textContent).toContain(
        'Added to your review deck',
      ),
    );
    // Toggle closed and open again: no duplicate introduction.
    fireEvent.click(screen.getByTestId('related-fahrkarte-noun'));
    fireEvent.click(screen.getByTestId('related-fahrkarte-noun'));
    expect(addToDeck).toHaveBeenCalledTimes(1);
    expect(addToDeck).toHaveBeenCalledWith(['fahrkarte-noun']);
  });

  it('missing extras degrade to the focus word and echo flow alone', async () => {
    render(
      <WordWorkspace
        word={karte}
        audio={speech('die Karte')}
        loadExtras={() => Promise.resolve(null)}
        addToDeck={vi.fn()}
        onEchoDone={vi.fn()}
      />,
    );
    expect(screen.getByTestId('focus-german').textContent).toBe('Karte');
    expect(screen.getByTestId('echo-heard')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('context-note')).toBeNull());
  });
});
