'use server';

import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile, lookupCorpus } from '@/db/seed/seed-vocab';
import {
  fsrsCardStateSchema,
  learnedWordSchema,
  learnerPaths,
  learnerProfileSchema,
  lessonSessionConverter,
  lessonSessionSchema,
  retentionScoreSchema,
  type FsrsCardState,
  type GrammarErrorCategory,
  type LessonSession,
  type SkillSlot,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import type { GrammarItem, Unit, VocabularyWord } from '@/lib/db/curriculum';
import { composeSession, poorGrammarItemsFrom } from '@/lib/lesson/engine';
import {
  dueRetests,
  makeRetestInjector,
  needsRemediation,
  type DueRetest,
} from '@/lib/assessment/retention';
import { disguiseWordFor } from '@/lib/lesson/retest-disguise';
import { buildSessionReport, persistSessionReport } from '@/lib/lesson/wrap-up';
import { evaluateListening, type ListeningEvaluation } from '@/lib/exercises/listening-eval';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';
import { getMediaProvider, type AudioAsset, type ImageAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { narratorFor } from '@/lib/media/tts';
import { TILE_ITEMS, type TileItem } from '@/lib/exercises/word-tiles';
import { buildRecognitionExercise, type RecognitionExercise } from '@/lib/exercises/image-id';
import { resolveImageStyle } from '@/lib/exercises/image-style';
import type { ReviewRating } from '@/lib/fsrs/scheduler';

// Lesson server actions (GT-220): compose or resume today's session, persist
// step progress, and close out with the GT-219 report. Brain evaluations
// return categorized failures as data, never crashes, so placeholder mode
// without a Gemini key stays fully walkable.

export interface ImageIdPayload {
  readonly word: VocabularyWord;
  readonly exercise: RecognitionExercise;
  readonly image: ImageAsset;
}

export interface DictationPayload {
  readonly text: string;
  readonly audio: AudioAsset;
}

// The warm-up presents reviews and disguised retests identically; only the
// runner's rating routing knows the difference (GT-304).
export type WarmupDisplayItem =
  | { readonly kind: 'review'; readonly word: VocabularyWord }
  | {
      readonly kind: 'retest';
      readonly word: VocabularyWord;
      readonly retestId: string;
      readonly unitId: string;
    };

export interface TodaySessionPayload {
  readonly session: LessonSession;
  readonly unit: Unit;
  readonly grammarItem: GrammarItem;
  readonly dayWords: readonly VocabularyWord[];
  readonly wordAudio: Readonly<Record<string, AudioAsset>>;
  readonly tileItem: TileItem;
  readonly decayedUnitIds: readonly string[];
  // Reviews (from the step's queueWordIds; cards whose ids fall outside the
  // corpus are omitted) followed by due disguised retests.
  readonly warmupItems: readonly WarmupDisplayItem[];
  readonly imageId: readonly ImageIdPayload[];
  readonly dictation: DictationPayload | null;
}

// Rotation and remediation inputs come from stored state: the most recent
// completed session drives the skill slot and grammar resurfacing (GT-108),
// and decayed retention (GT-305) adds its units' grammar items.
async function planningInputs(now: Date): Promise<{
  lastSkillSlot: SkillSlot | null;
  poorGrammarItemIds: string[];
  decayed: string[];
  dueRetestItems: DueRetest[];
}> {
  const store = getDataStore();
  const [rawSessions, rawRetentions] = await Promise.all([
    store.list(learnerPaths.sessions()),
    store.list(learnerPaths.retentionScores()),
  ]);
  const completed = rawSessions
    .map((data) => lessonSessionSchema.safeParse(data))
    .flatMap((parsed) =>
      parsed.success && parsed.data.status === 'completed' ? [parsed.data] : [],
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = completed[completed.length - 1] ?? null;
  const lastSlotStep = last?.steps.find((step) => step.kind === 'skill-practice');
  const retentions = rawRetentions
    .map((data) => retentionScoreSchema.safeParse(data))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const decayed = retentions
    .filter((retention) => needsRemediation(retention))
    .map((retention) => retention.unitId);
  const decayedGrammar = seedUnits
    .filter((unit) => decayed.includes(unit.id))
    .flatMap((unit) => unit.grammarItemIds);
  // Passed units (passedAt set) feed the 7/14/30/60-day retest schedule.
  const passedUnits = retentions
    .filter((retention) => retention.passedAt !== null)
    .map((retention) => ({
      unitId: retention.unitId,
      passedAt: retention.passedAt as string,
      retention,
    }));
  return {
    lastSkillSlot: lastSlotStep?.kind === 'skill-practice' ? lastSlotStep.slot : null,
    poorGrammarItemIds: [...poorGrammarItemsFrom(last), ...decayedGrammar],
    decayed,
    dueRetestItems: dueRetests(passedUnits, now),
  };
}

async function loadActiveSession(sessionId: string): Promise<LessonSession | null> {
  const raw = await getDataStore().collection(learnerPaths.sessions()).doc(sessionId).get();
  const parsed = raw ? lessonSessionSchema.safeParse(raw) : null;
  // Resume only interrupted sessions; a completed one composes fresh so
  // repeat visits (and repeated e2e runs) start a walkable session.
  return parsed?.success && parsed.data.status === 'active' ? parsed.data : null;
}

export async function getTodaySession(): Promise<TodaySessionPayload | null> {
  const store = getDataStore();
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const rawProfile = await store.collection(learners).doc(learnerId).get();
  const profile = rawProfile ? learnerProfileSchema.safeParse(rawProfile) : null;
  if (!profile?.success) return null;

  const unit = seedUnits.find((candidate) => candidate.id === profile.data.unitId);
  if (!unit) return null;

  const now = new Date();
  const sessionId = `session-${now.toISOString().slice(0, 10)}`;
  const existing = await loadActiveSession(sessionId);
  const corpus = loadVocabSeedFile(profile.data.level);
  const [rawCards, rawLearned] = await Promise.all([
    store.list(learnerPaths.cards()),
    store.list(learnerPaths.learnedWords()),
  ]);
  const cards = rawCards
    .map((data) => fsrsCardStateSchema.safeParse(data))
    .flatMap((parsed): FsrsCardState[] => (parsed.success ? [parsed.data] : []));
  // Words already carrying a card were introduced in an earlier session, and
  // words marked learned in the Learn section are known; neither reappears
  // as "new".
  const learnedWordIds = new Set([
    ...cards.map((card) => card.wordId),
    ...rawLearned
      .map((data) => learnedWordSchema.safeParse(data))
      .flatMap((parsed) => (parsed.success ? [parsed.data.wordId] : [])),
  ]);
  const planning = await planningInputs(now);
  const remediationItems = seedGrammarItems.filter((item) =>
    planning.poorGrammarItemIds.includes(item.id),
  );
  const session =
    existing ??
    composeSession({
      unit,
      unitGrammarItems: [
        ...seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id)),
        ...remediationItems.filter((item) => !unit.grammarItemIds.includes(item.id)),
      ],
      corpus,
      learnedWordIds,
      cards,
      lastSkillSlot: planning.lastSkillSlot,
      poorGrammarItemIds: planning.poorGrammarItemIds,
      now,
      injectExtras: makeRetestInjector(planning.dueRetestItems),
    });
  if (!existing) {
    await store
      .collection(learnerPaths.sessions())
      .doc(session.id)
      .set(lessonSessionConverter.toFirestore(session));
  }

  const vocabStep = session.steps.find((step) => step.kind === 'new-vocabulary');
  const wordIds = vocabStep?.kind === 'new-vocabulary' ? vocabStep.wordIds : [];
  const wordsById = new Map(corpus.map((word) => [word.id, word]));
  const dayWords = wordIds
    .map((id) => wordsById.get(id))
    .filter((word): word is VocabularyWord => word !== undefined);

  const provider = getMediaProvider();
  // Register every clip first, then fetch concurrently: with on-demand
  // synthesis the first session of a day mints several clips, and the
  // bounded generation waits must overlap, not stack.
  const echoWords = dayWords.slice(0, 3);
  const narrator = narratorFor(profile.data.settings.voice);
  for (const word of echoWords) {
    const label = word.article ? `${word.article} ${word.german}` : word.german;
    registerPlaceholderClip(`word-${word.id}`, label, { speakers: narrator });
  }
  const dictationWord = dayWords.find((word) => word.exampleDe !== null);
  if (dictationWord?.exampleDe) {
    registerPlaceholderClip(`dict-${dictationWord.id}`, dictationWord.exampleDe, {
      speakers: narrator,
    });
  }
  const [echoAudio, dictationAudio] = await Promise.all([
    Promise.all(echoWords.map((word) => provider.getAudio(`word-${word.id}`))),
    dictationWord?.exampleDe
      ? provider.getAudio(`dict-${dictationWord.id}`)
      : Promise.resolve(null),
  ]);
  const wordAudio: Record<string, AudioAsset> = {};
  echoWords.forEach((word, index) => {
    wordAudio[word.id] = echoAudio[index] as AudioAsset;
  });

  const grammarStep = session.steps.find((step) => step.kind === 'grammar-focus');
  const grammarItem =
    seedGrammarItems.find(
      (item) => grammarStep?.kind === 'grammar-focus' && item.id === grammarStep.grammarItemId,
    ) ?? (seedGrammarItems[0] as GrammarItem);

  // Warm-up display spans everything a card can reference, including the
  // foundation entries (numbers, pronouns) learned in the Learn section.
  // Due retests follow the reviews, each wearing a deterministic corpus word
  // as its face (GT-304: indistinguishable from a review).
  const warmupStep = session.steps.find((step) => step.kind === 'warm-up');
  const lookupById = new Map(lookupCorpus().map((word) => [word.id, word]));
  const reviewItems: WarmupDisplayItem[] = (
    warmupStep?.kind === 'warm-up' ? warmupStep.queueWordIds : []
  )
    .map((id) => lookupById.get(id))
    .filter((word): word is VocabularyWord => word !== undefined)
    .map((word) => ({ kind: 'review', word }));
  const retestItems: WarmupDisplayItem[] = planning.dueRetestItems.flatMap((retest) => {
    const word = disguiseWordFor(retest.retestId, corpus);
    return word
      ? [{ kind: 'retest' as const, word, retestId: retest.retestId, unitId: retest.unitId }]
      : [];
  });
  const warmupItems = [...reviewItems, ...retestItems];

  // Image identification inside the vocab step (PRD 4.3): up to two
  // picturable words from today's set, recognition phase, adapter-served
  // images in the learner's resolved style.
  const imageId: ImageIdPayload[] = [];
  for (const word of dayWords.filter((candidate) => candidate.picturable).slice(0, 2)) {
    const style = resolveImageStyle(profile.data.settings.imageStyle, word);
    const label = word.article ? `${word.article} ${word.german}` : word.german;
    imageId.push({
      word,
      exercise: buildRecognitionExercise(word, corpus),
      image: await provider.getImage(label, style),
    });
  }

  // Dictation rides the writing slot using a day word's example sentence, so
  // the dictated German is always level-bound corpus material.
  const dictation: DictationPayload | null =
    dictationWord?.exampleDe && dictationAudio
      ? { text: dictationWord.exampleDe, audio: dictationAudio }
      : null;

  return {
    session,
    unit,
    grammarItem,
    dayWords,
    wordAudio,
    tileItem: TILE_ITEMS[0] as TileItem,
    decayedUnitIds: planning.decayed,
    warmupItems,
    imageId,
    dictation,
  };
}

export async function saveSession(rawSession: unknown): Promise<void> {
  const session = lessonSessionSchema.parse(rawSession);
  await getDataStore()
    .collection(learnerPaths.sessions())
    .doc(session.id)
    .set(lessonSessionConverter.toFirestore(session));
}

export type ListeningEvaluationOutcome =
  | { readonly ok: true; readonly evaluation: ListeningEvaluation }
  | { readonly ok: false; readonly category: string };

export async function evaluateListeningAction(input: {
  clipText: string;
  learnerResponse: string;
  level: 'A1' | 'A2' | 'B1';
}): Promise<ListeningEvaluationOutcome> {
  try {
    const evaluation = await evaluateListening(getGeminiClient(), input);
    return { ok: true, evaluation };
  } catch (error) {
    return { ok: false, category: error instanceof GeminiError ? error.category : 'network' };
  }
}

export async function completeSession(input: {
  session: unknown;
  warmupRatings: ReviewRating[];
  imageIdResults: boolean[];
  scenarioScore: number | null;
  skillScores?: Partial<Record<'listening' | 'reading' | 'writing' | 'speaking', number>>;
  errorsByCategory?: Partial<Record<GrammarErrorCategory, number>>;
}): Promise<void> {
  const session = lessonSessionSchema.parse(input.session);
  const store = getDataStore();
  await store
    .collection(learnerPaths.sessions())
    .doc(session.id)
    .set(lessonSessionConverter.toFirestore(session));
  const vocabStep = session.steps.find((step) => step.kind === 'new-vocabulary');
  const report = buildSessionReport({
    session,
    warmupRatings: input.warmupRatings,
    newWordIds: vocabStep?.kind === 'new-vocabulary' ? vocabStep.wordIds : [],
    imageIdResults: input.imageIdResults,
    scenarioScore: input.scenarioScore,
    skillScores: input.skillScores ?? {},
    errorsByCategory: input.errorsByCategory ?? {},
  });
  await persistSessionReport(store, session, report);
}
