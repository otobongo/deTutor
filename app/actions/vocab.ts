'use server';

import { cumulativeCorpus, loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { relatedWordsFor, type RelatedWord } from '@/lib/lesson/related-words';
import { loadOrCreateWordNote } from '@/lib/lesson/word-notes';
import { getGeminiClient } from '@/lib/gemini/client';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';

// Word workspace extras (owner-directed 2026-07-10): everything around the
// focus word that is worth a second glance. Loaded after the card renders so
// the echo flow never waits on the brain; each piece degrades independently.

export interface WordExtrasPayload {
  readonly note: { readonly text: string; readonly audio: AudioAsset } | null;
  readonly senses: readonly string[];
  readonly example: { readonly text: string; readonly audio: AudioAsset } | null;
  readonly related: readonly RelatedWord[];
}

export async function getWordExtrasAction(wordId: string): Promise<WordExtrasPayload | null> {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) return null;
  const word = cumulativeCorpus('B1').find((candidate) => candidate.id === wordId);
  if (!word) return null;

  // Neighborhood stays at the learner's level: an A1 profile only ever sees
  // A1 neighbors.
  const levelCorpus = loadVocabSeedFile(profile.level);
  const related = relatedWordsFor(word, levelCorpus);

  const provider = getMediaProvider();
  const note = await loadOrCreateWordNote(store, getGeminiClient(), word);
  if (note) registerPlaceholderClip(`note-${word.id}`, note.note, 'en-US');
  if (word.exampleDe) registerPlaceholderClip(`ex-${word.id}`, word.exampleDe);

  const [noteAudio, exampleAudio] = await Promise.all([
    note ? provider.getAudio(`note-${word.id}`) : Promise.resolve(null),
    word.exampleDe ? provider.getAudio(`ex-${word.id}`) : Promise.resolve(null),
  ]);

  return {
    note: note && noteAudio ? { text: note.note, audio: noteAudio } : null,
    senses: note?.senses ?? [],
    example: word.exampleDe && exampleAudio ? { text: word.exampleDe, audio: exampleAudio } : null,
    related,
  };
}
