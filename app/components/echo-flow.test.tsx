// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import { EchoFlow } from './echo-flow';

const word: VocabularyWord = {
  id: 'tisch-noun',
  german: 'Tisch',
  wordType: 'noun',
  article: 'der',
  translation: 'table',
  ipa: null,
  exampleDe: null,
  exampleEn: null,
  cefrLevel: 'A1',
  theme: 'home-living',
  picturable: true,
  frequencyRank: 412,
};

const audio: AudioAsset = {
  clipId: 'word-tisch-noun',
  source: { type: 'speech-synthesis', text: 'der Tisch', lang: 'de-DE' },
  captionsRequired: true,
  captionText: 'der Tisch',
};

afterEach(cleanup);

describe('echo flow (GT-201)', () => {
  it('requires two presentations, production, and the fast pass before done', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<EchoFlow word={word} audio={audio} onDone={onDone} />);

    await user.click(screen.getByTestId('echo-heard'));
    await user.click(screen.getByTestId('echo-heard'));

    // Production step: submit is disabled until the learner types something.
    expect((screen.getByTestId('echo-produce') as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByTestId('echo-production-input'), 'der Tisch');
    await user.click(screen.getByTestId('echo-produce'));

    await user.click(screen.getByTestId('echo-fast-pass-done'));
    expect(onDone).toHaveBeenCalledWith('der Tisch');
  });

  it('never renders the done button before production', () => {
    render(<EchoFlow word={word} audio={audio} onDone={() => {}} />);
    expect(screen.queryByTestId('echo-fast-pass-done')).toBeNull();
    expect(screen.queryByTestId('echo-production-input')).toBeNull();
  });
});
