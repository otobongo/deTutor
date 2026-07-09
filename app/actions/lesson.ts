'use server';

import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { listeningClipId, UNIT_LISTENING_CLIPS } from '@/db/seed/listening-clips';
import {
  learnerPaths,
  learnerProfileSchema,
  lessonSessionConverter,
  lessonSessionSchema,
  retentionScoreSchema,
  type LessonSession,
  type SkillSlot,
} from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import type { GrammarItem, Unit, VocabularyWord } from '@/lib/db/curriculum';
import { composeSession, poorGrammarItemsFrom } from '@/lib/lesson/engine';
import { needsRemediation } from '@/lib/assessment/retention';
import { buildSessionReport, persistSessionReport } from '@/lib/lesson/wrap-up';
import { evaluateListening, type ListeningEvaluation } from '@/lib/exercises/listening-eval';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { TILE_ITEMS, type TileItem } from '@/lib/exercises/word-tiles';
import type { ReviewRating } from '@/lib/fsrs/scheduler';

// Lesson server actions (GT-220): compose or resume today's session, persist
// step progress, and close out with the GT-219 report. Brain evaluations
// return categorized failures as data, never crashes, so placeholder mode
// without a Gemini key stays fully walkable.

for (const [unitId, text] of Object.entries(UNIT_LISTENING_CLIPS)) {
  registerPlaceholderClip(listeningClipId(unitId), text);
}

export interface TodaySessionPayload {
  readonly session: LessonSession;
  readonly unit: Unit;
  readonly grammarItem: GrammarItem;
  readonly dayWords: readonly VocabularyWord[];
  readonly wordAudio: Readonly<Record<string, AudioAsset>>;
  readonly listeningClip: AudioAsset;
  readonly tileItem: TileItem;
  readonly decayedUnitIds: readonly string[];
}

// Rotation and remediation inputs come from stored state: the most recent
// completed session drives the skill slot and grammar resurfacing (GT-108),
// and decayed retention (GT-305) adds its units' grammar items.
async function planningInputs(): Promise<{
  lastSkillSlot: SkillSlot | null;
  poorGrammarItemIds: string[];
  decayed: string[];
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
  const decayed = rawRetentions
    .map((data) => retentionScoreSchema.safeParse(data))
    .flatMap((parsed) =>
      parsed.success && needsRemediation(parsed.data) ? [parsed.data.unitId] : [],
    );
  const decayedGrammar = seedUnits
    .filter((unit) => decayed.includes(unit.id))
    .flatMap((unit) => unit.grammarItemIds);
  return {
    lastSkillSlot: lastSlotStep?.kind === 'skill-practice' ? lastSlotStep.slot : null,
    poorGrammarItemIds: [...poorGrammarItemsFrom(last), ...decayedGrammar],
    decayed,
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
  const planning = await planningInputs();
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
      learnedWordIds: new Set<string>(),
      cards: [],
      lastSkillSlot: planning.lastSkillSlot,
      poorGrammarItemIds: planning.poorGrammarItemIds,
      now,
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
  const wordAudio: Record<string, AudioAsset> = {};
  for (const word of dayWords.slice(0, 3)) {
    const label = word.article ? `${word.article} ${word.german}` : word.german;
    registerPlaceholderClip(`word-${word.id}`, label);
    wordAudio[word.id] = await provider.getAudio(`word-${word.id}`);
  }

  const grammarStep = session.steps.find((step) => step.kind === 'grammar-focus');
  const grammarItem =
    seedGrammarItems.find(
      (item) => grammarStep?.kind === 'grammar-focus' && item.id === grammarStep.grammarItemId,
    ) ?? (seedGrammarItems[0] as GrammarItem);

  return {
    session,
    unit,
    grammarItem,
    dayWords,
    wordAudio,
    listeningClip: await provider.getAudio(listeningClipId(unit.id)),
    tileItem: TILE_ITEMS[0] as TileItem,
    decayedUnitIds: planning.decayed,
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
    skillScores: {},
    errorsByCategory: {},
  });
  await persistSessionReport(store, session, report);
}
