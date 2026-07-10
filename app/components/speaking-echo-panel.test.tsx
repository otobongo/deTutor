// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { EchoAttemptOutcome, EchoSnapshot } from '@/app/actions/speaking';
import { SpeakingEchoPanel } from './speaking-echo-panel';

const word: VocabularyWord = {
  id: 'hund-noun',
  german: 'Hund',
  wordType: 'noun',
  article: 'der',
  translation: 'dog',
  ipa: 'hʊnt',
  exampleDe: null,
  exampleEn: null,
  cefrLevel: 'A1',
  theme: 'nature-weather',
  picturable: true,
  frequencyRank: 210,
};

const audio: AudioAsset = {
  clipId: 'word-hund-noun',
  source: { type: 'speech-synthesis', text: 'der Hund', lang: 'de-DE' },
  captionsRequired: true,
  captionText: 'der Hund',
};

function confirmedOutcome(snapshot: EchoSnapshot): EchoAttemptOutcome {
  return {
    ok: true,
    state: {
      target: snapshot.target,
      attempts: snapshot.attempts + 1,
      status: 'confirmed',
      lastAssessment: {
        verdict: 'correct',
        missingSounds: [],
        stressNote: null,
        encouragement: 'Genau so! That was spot on.',
      },
    },
  };
}

afterEach(cleanup);

describe('speaking echo panel', () => {
  it('confirms a correct echo and moves to the next word', async () => {
    const attempt = vi
      .fn()
      .mockImplementation((snapshot: EchoSnapshot) => Promise.resolve(confirmedOutcome(snapshot)));
    render(<SpeakingEchoPanel targets={[{ word, audio }]} attempt={attempt} />);

    expect(screen.getByTestId('speaking-target').textContent).toContain('Hund');
    fireEvent.change(screen.getByTestId('speaking-transcript'), {
      target: { value: 'der Hund' },
    });
    fireEvent.click(screen.getByTestId('speaking-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('speaking-feedback').textContent).toContain('Genau so'),
    );
    expect(attempt).toHaveBeenCalledWith(
      { target: 'der Hund', attempts: 0, status: 'awaiting-response' },
      'der Hund',
    );

    fireEvent.click(screen.getByTestId('speaking-next'));
    expect(screen.getByTestId('speaking-done')).toBeTruthy();
  });

  it('a brain outage reports honestly and still offers a way onward', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValue({ ok: false, category: 'network', attempts: 0 } as EchoAttemptOutcome);
    render(<SpeakingEchoPanel targets={[{ word, audio }]} attempt={attempt} />);

    fireEvent.change(screen.getByTestId('speaking-transcript'), { target: { value: 'Hund' } });
    fireEvent.click(screen.getByTestId('speaking-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('speaking-feedback').textContent).toContain('not reachable'),
    );
    expect(screen.getByTestId('speaking-next')).toBeTruthy();
  });
});
