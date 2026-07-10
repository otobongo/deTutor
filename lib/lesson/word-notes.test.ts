import { describe, expect, it, vi } from 'vitest';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import type { DocumentStore } from '@/lib/db/store';
import { loadOrCreateWordNote, WORD_NOTES_COLLECTION } from './word-notes';

const karte: VocabularyWord = {
  id: 'karte-noun',
  german: 'Karte',
  wordType: 'noun',
  article: 'die',
  translation: 'card, map',
  ipa: null,
  exampleDe: null,
  exampleEn: null,
  cefrLevel: 'A1',
  theme: 'city-transport',
  picturable: true,
  frequencyRank: 100,
};

function memoryStore(): DocumentStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    collection: (collectionPath: string) => ({
      doc: (docId: string) => ({
        get: () => Promise.resolve(data.get(`${collectionPath}/${docId}`) ?? null),
        set: (value: unknown) => {
          data.set(`${collectionPath}/${docId}`, value);
          return Promise.resolve();
        },
      }),
    }),
    list: () => Promise.resolve([]),
  } as unknown as DocumentStore & { data: Map<string, unknown> };
}

function clientReturning(value: unknown): GeminiClient {
  return {
    chat: vi.fn(),
    generateJson: vi.fn().mockResolvedValue(value),
  } as unknown as GeminiClient;
}

describe('word notes cache-through', () => {
  it('generates once, persists, and serves the cached note afterwards', async () => {
    const store = memoryStore();
    const client = clientReturning({ note: 'Karte means card or map.', senses: ['card', 'map'] });
    const first = await loadOrCreateWordNote(store, client, karte);
    expect(first).toEqual({
      wordId: 'karte-noun',
      note: 'Karte means card or map.',
      senses: ['card', 'map'],
    });
    expect(store.data.has(`${WORD_NOTES_COLLECTION}/karte-noun`)).toBe(true);

    const second = await loadOrCreateWordNote(store, client, karte);
    expect(second).toEqual(first);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it('a brain outage returns null and caches nothing', async () => {
    const store = memoryStore();
    const client = {
      chat: vi.fn(),
      generateJson: vi.fn().mockRejectedValue(new GeminiError('network', 'offline')),
    } as unknown as GeminiClient;
    expect(await loadOrCreateWordNote(store, client, karte)).toBeNull();
    expect(store.data.size).toBe(0);
  });
});
