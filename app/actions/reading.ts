'use server';

import { fallbackReadingFor } from '@/db/seed/reading-fallback';
import { seedUnits } from '@/db/seed/units';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { generateReadingText } from '@/lib/exercises/reading-gen';
import {
  generateReadingTask,
  readingTaskSchema,
  scoreReadingTask,
  writeReadingScore,
  type ReadingTask,
} from '@/lib/exercises/reading-tasks';
import { generateMiniCard, lookupTappedWord } from '@/lib/exercises/tap-to-queue';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';
import { introduceWordsAction } from './cards';

// Reading slot actions: brain-generated text and task inside the code-owned
// envelope, with the curated A1 fallback so the slot never blocks on the
// brain. Scoring is deterministic and appends to SkillScore(reading).

export interface ReadingExercisePayload {
  readonly source: 'brain' | 'fallback';
  readonly title: string;
  readonly text: string;
  readonly task: ReadingTask;
}

export async function getReadingExerciseAction(): Promise<ReadingExercisePayload | null> {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) return null;
  const unit = seedUnits.find((candidate) => candidate.id === profile.unitId);
  const corpus = cumulativeCorpus(profile.level);
  try {
    const client = getGeminiClient();
    const generated = await generateReadingText(client, {
      level: profile.level,
      theme: unit?.theme ?? 'everyday life',
      corpus,
    });
    const task = await generateReadingTask(client, {
      format: 'richtig-falsch',
      level: profile.level,
      text: generated.text,
      itemCount: 3,
    });
    return { source: 'brain', title: generated.title, text: generated.text, task };
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    const fallback = fallbackReadingFor(new Date());
    return {
      source: 'fallback',
      title: fallback.title,
      text: fallback.task.text,
      task: fallback.task,
    };
  }
}

export interface ReadingSubmission {
  readonly correct: number;
  readonly total: number;
  readonly score: number;
}

export async function submitReadingAction(
  rawTask: unknown,
  answers: readonly boolean[],
): Promise<ReadingSubmission | null> {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) return null;
  const task = readingTaskSchema.parse(rawTask);
  const result = scoreReadingTask(task, { format: 'richtig-falsch', answers });
  await writeReadingScore(store, profile.unitId, result.score, new Date().toISOString());
  return result;
}

// Tap-to-queue: corpus words enqueue directly; unknown words ask the brain
// for a mini card. Offline taps still answer, they just cannot mint a card.
export type TapOutcome =
  | {
      readonly kind: 'corpus';
      readonly word: VocabularyWord;
      readonly added: boolean;
    }
  | {
      readonly kind: 'mini';
      readonly german: string;
      readonly article: string | null;
      readonly translation: string;
      readonly added: boolean;
    }
  | { readonly kind: 'unknown' };

export async function tapWordAction(token: string): Promise<TapOutcome> {
  const corpus = cumulativeCorpus('B1');
  const word = lookupTappedWord(token, corpus);
  if (word) {
    const added = (await introduceWordsAction([word.id])) > 0;
    return { kind: 'corpus', word, added };
  }
  try {
    const mini = await generateMiniCard(getGeminiClient(), token);
    const added = (await introduceWordsAction([mini.id])) > 0;
    return {
      kind: 'mini',
      german: mini.german,
      article: mini.article,
      translation: mini.translation,
      added,
    };
  } catch (error) {
    if (error instanceof GeminiError) return { kind: 'unknown' };
    throw error;
  }
}
