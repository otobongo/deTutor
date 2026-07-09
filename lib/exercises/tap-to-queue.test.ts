import { describe, expect, it } from 'vitest';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { dueCards } from '@/lib/fsrs/queue';
import { createGeminiClient, type GeminiTransport } from '@/lib/gemini/client';
import { enqueueTappedWord, generateMiniCard, lookupTappedWord } from './tap-to-queue';

const corpus = loadVocabSeedFile('A1');
const now = new Date('2026-07-09T08:00:00.000Z');

describe('tap-to-queue (GT-209)', () => {
  it('resolves an in-corpus tap to the existing word id', () => {
    const anchor = corpus[0];
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const found = lookupTappedWord(`${anchor.german}!`, corpus);
    expect(found?.id).toBe(anchor.id);
  });

  it('enqueues the tapped word as a new FSRS card, due immediately', () => {
    const result = enqueueTappedWord(new Map(), 'tisch-noun', now);
    expect(result.added).toBe(true);
    const due = dueCards([...result.cards.values()], now, 10);
    expect(due.map((card) => card.wordId)).toContain('tisch-noun');
  });

  it('a duplicate tap does not create a second card or reset the first', () => {
    const first = enqueueTappedWord(new Map(), 'tisch-noun', now);
    const again = enqueueTappedWord(
      first.cards,
      'tisch-noun',
      new Date('2026-07-10T08:00:00.000Z'),
    );
    expect(again.added).toBe(false);
    expect(again.cards).toBe(first.cards);
    expect(again.cards.size).toBe(1);
  });

  it('generates a schema-valid mini-card for out-of-corpus words', async () => {
    const transport: GeminiTransport = {
      generate: () =>
        Promise.resolve(
          JSON.stringify({
            german: 'Quasselstrippe',
            wordType: 'noun',
            article: 'die',
            translation: 'chatterbox',
          }),
        ),
    };
    const client = createGeminiClient(transport, { fast: 'f', deep: 'd' }, () => {});
    const card = await generateMiniCard(client, 'Quasselstrippe');
    expect(card.id).toBe('quasselstrippe-noun');
    expect(card.article).toBe('die');
  });
});
