'use server';

import { lookupCorpus } from '@/db/seed/seed-vocab';
import { foundationTopicById } from '@/db/seed/foundations';
import {
  foundationProgressConverter,
  foundationProgressSchema,
  learnedWordConverter,
  learnedWordSchema,
  learnerPaths,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { scoreQuiz, type QuizResult } from '@/lib/learn/progress';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { narratorFor } from '@/lib/media/tts';
import { introduceWordsAction } from './cards';

// Learn actions (owner-directed 2026-07-10): marking is a learner
// declaration, tracked per learner; nothing gates on it. Marking a word also
// introduces its FSRS card so it joins warm-up reviews; un-marking removes
// the declaration but never the card (scheduled reviews are real history).

export async function markWordLearnedAction(wordId: string, learned: boolean): Promise<void> {
  const word = lookupCorpus().find((candidate) => candidate.id === wordId);
  if (!word) throw new Error(`Unknown word "${wordId}".`);
  const doc = getDataStore().collection(learnerPaths.learnedWords()).doc(wordId);
  if (learned) {
    await doc.set(
      learnedWordConverter.toFirestore(
        learnedWordSchema.parse({ wordId, learnedAt: new Date().toISOString() }),
      ),
    );
    await introduceWordsAction([wordId]);
  } else {
    await doc.delete();
  }
}

export type FoundationQuizOutcome = QuizResult & { readonly bestScore: number };

export async function submitFoundationQuizAction(
  topicId: string,
  answers: readonly number[],
): Promise<FoundationQuizOutcome> {
  const topic = foundationTopicById(topicId);
  if (!topic) throw new Error(`Unknown foundation topic "${topicId}".`);
  const result = scoreQuiz(topic.quiz, answers);
  const store = getDataStore();
  const doc = store.collection(learnerPaths.foundationProgress()).doc(topicId);
  const existingRaw = await doc.get();
  const existing = existingRaw ? foundationProgressSchema.safeParse(existingRaw) : null;
  const previous = existing?.success ? existing.data : null;
  const bestScore = Math.max(result.score, previous?.bestScore ?? 0);
  await doc.set(
    foundationProgressConverter.toFirestore(
      foundationProgressSchema.parse({
        topicId,
        marked: previous?.marked ?? false,
        bestScore,
        attempts: (previous?.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
  return { ...result, bestScore };
}

export async function markFoundationLearnedAction(topicId: string, marked: boolean): Promise<void> {
  const topic = foundationTopicById(topicId);
  if (!topic) throw new Error(`Unknown foundation topic "${topicId}".`);
  const store = getDataStore();
  const doc = store.collection(learnerPaths.foundationProgress()).doc(topicId);
  const existingRaw = await doc.get();
  const existing = existingRaw ? foundationProgressSchema.safeParse(existingRaw) : null;
  const previous = existing?.success ? existing.data : null;
  await doc.set(
    foundationProgressConverter.toFirestore(
      foundationProgressSchema.parse({
        topicId,
        marked,
        bestScore: previous?.bestScore ?? null,
        attempts: previous?.attempts ?? 0,
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
}

// Pronunciation audio for any learnable word, on demand (neighbor chips and
// the Learn flow), spoken in the learner's chosen voice.
export async function getWordAudioAction(wordId: string): Promise<AudioAsset | null> {
  const profile = await loadLearnerProfile(getDataStore());
  const word = lookupCorpus().find((candidate) => candidate.id === wordId);
  if (!profile || !word) return null;
  const label = word.article ? `${word.article} ${word.german}` : word.german;
  registerPlaceholderClip(`word-${word.id}`, label, {
    speakers: narratorFor(profile.settings.voice),
  });
  return getMediaProvider().getAudio(`word-${word.id}`);
}
