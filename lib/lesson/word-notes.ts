import { z } from 'zod';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { DocumentStore } from '@/lib/db/store';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';

// Word notes (owner-directed 2026-07-10): a short plain-English explanation
// of when and how Germans use a word, plus its distinct senses when it has
// several (Karte: card, map). Generated once by the brain, cached in the
// store forever, spoken through the same on-demand TTS path as everything
// else. A brain outage means no note this time, never a broken card.

export const wordNoteSchema = z.object({
  wordId: z.string().min(1),
  note: z.string().min(1),
  senses: z.array(z.string().min(1)).max(4),
});
export type WordNote = z.infer<typeof wordNoteSchema>;

export const WORD_NOTES_COLLECTION = 'wordNotes';

export async function generateWordNote(
  client: GeminiClient,
  word: VocabularyWord,
): Promise<WordNote> {
  const label = word.article ? `${word.article} ${word.german}` : word.german;
  const generated = await client.generateJson(
    [
      {
        role: 'learner',
        text:
          `Explain the German word "${label}" (${word.translation}) to an absolute beginner.\n` +
          'Return JSON: {"note":string,"senses":string[]}.\n' +
          'note: one or two short, warm English sentences on when and how Germans actually ' +
          'use this word, with one tiny usage tip if there is a classic beginner mistake. ' +
          'Never use em dashes; use commas or parentheses instead.\n' +
          'senses: the distinct English meanings when the word genuinely has more than one ' +
          '(like Karte: card, map); an empty array when it has only one.',
      },
    ],
    wordNoteSchema.omit({ wordId: true }),
    { callSite: 'vocab-enrichment' },
  );
  return { wordId: word.id, ...generated };
}

// Cache-through load: the store copy wins; a miss generates and persists.
// Returns null when the brain is unreachable so the UI degrades quietly.
export async function loadOrCreateWordNote(
  store: DocumentStore,
  client: GeminiClient,
  word: VocabularyWord,
): Promise<WordNote | null> {
  const cached = await store.collection(WORD_NOTES_COLLECTION).doc(word.id).get();
  if (cached) {
    const parsed = wordNoteSchema.safeParse(cached);
    if (parsed.success) return parsed.data;
  }
  try {
    const note = await generateWordNote(client, word);
    await store.collection(WORD_NOTES_COLLECTION).doc(word.id).set(wordNoteSchema.parse(note));
    return note;
  } catch (error) {
    if (error instanceof GeminiError) return null;
    throw error;
  }
}
