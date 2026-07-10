'use server';

import { z } from 'zod';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import {
  learnerPaths,
  learnerProfileConverter,
  learnerProfileSchema,
  retentionScoreConverter,
  retentionScoreSchema,
  unitProgressConverter,
  unitProgressSchema,
  type UnitProgressDoc,
} from '@/lib/db/learner';
import { initialRetention } from '@/lib/assessment/retention';
import { getDataStore } from '@/lib/db/store';
import type { Skill, Unit } from '@/lib/db/curriculum';
import { getGeminiClient } from '@/lib/gemini/client';
import { generateUnitTest, unitTestSchema, type UnitTest } from '@/lib/assessment/unit-test-gen';
import { buildPlaceholderUnitTest } from '@/lib/assessment/placeholder-unit-test';
import {
  applyRetake,
  completeRemediation as completeRemediationPure,
  startUnitProgress,
  unitComplete,
  type UnitProgress,
} from '@/lib/assessment/remediation';
import {
  recordSkillScore,
  scoreUnitTest,
  type ProductionRubricResult,
} from '@/lib/assessment/scoring';

// Unit test server actions (GT-401 flow wiring). Generation prefers the
// brain (deep tier); when it is unreachable the deterministic placeholder
// test keeps the whole flow exercisable, labeled honestly.

export interface UnitTestPayload {
  readonly test: UnitTest;
  readonly source: 'gemini' | 'placeholder';
  readonly unit: Unit;
}

async function currentUnit(): Promise<Unit | null> {
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const raw = await getDataStore().collection(learners).doc(learnerId).get();
  const profile = raw ? learnerProfileSchema.safeParse(raw) : null;
  if (!profile?.success) return null;
  return seedUnits.find((unit) => unit.id === profile.data.unitId) ?? null;
}

export async function getUnitTestForCurrentUnit(attempt: number): Promise<UnitTestPayload | null> {
  const unit = await currentUnit();
  if (!unit) return null;
  const unitGrammarItems = seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id));
  const vocabulary = cumulativeCorpus(unit.level).filter((word) => word.theme === unit.theme);
  const fullVocab = vocabulary.length >= 20 ? vocabulary : cumulativeCorpus(unit.level);
  try {
    const test = await generateUnitTest(getGeminiClient(), {
      unit,
      unitGrammarItems,
      unitVocabulary: fullVocab,
      attempt,
    });
    return { test, source: 'gemini', unit };
  } catch {
    return {
      test: buildPlaceholderUnitTest(unit, unitGrammarItems, fullVocab, attempt),
      source: 'placeholder',
      unit,
    };
  }
}

function toDoc(progress: UnitProgress): UnitProgressDoc {
  return unitProgressSchema.parse({
    unitId: progress.unitId,
    skills: progress.skills,
    remediation: progress.remediation,
  });
}

function fromDoc(doc: UnitProgressDoc): UnitProgress {
  return {
    unitId: doc.unitId,
    skills: doc.skills as UnitProgress['skills'],
    remediation: doc.remediation,
  };
}

async function saveProgress(progress: UnitProgress): Promise<void> {
  await getDataStore()
    .collection(learnerPaths.unitProgress())
    .doc(progress.unitId)
    .set(unitProgressConverter.toFirestore(toDoc(progress)));
}

export async function loadUnitProgress(unitId: string): Promise<UnitProgressDoc | null> {
  const raw = await getDataStore().collection(learnerPaths.unitProgress()).doc(unitId).get();
  const parsed = raw ? unitProgressSchema.safeParse(raw) : null;
  return parsed?.success ? parsed.data : null;
}

const submissionInput = z.object({
  test: unitTestSchema,
  listening: z.array(z.boolean()),
  reading: z.array(z.boolean()),
  writing: z.object({
    errorCount: z.number().int().nonnegative(),
    contentPointsCovered: z.number().int().nonnegative(),
    contentPointsTotal: z.number().int().positive(),
  }),
  speaking: z.object({
    errorCount: z.number().int().nonnegative(),
    contentPointsCovered: z.number().int().nonnegative(),
    contentPointsTotal: z.number().int().positive(),
  }),
});

export interface SubmissionOutcome {
  readonly progress: UnitProgressDoc;
  readonly complete: boolean;
  // The unit the profile advanced to, or null when it stayed (not the
  // current unit, mid-level gate, or already advanced earlier).
  readonly advancedToUnitId: string | null;
}

// Completing a unit has two side effects the loop depends on: the retention
// record starts (passedAt anchors the 7/14/30/60-day retest schedule), and
// the profile advances to the next unit within the level. Level boundaries
// do not auto-advance: the level gate exam (GT-306) is its own event.
async function onUnitComplete(unitId: string): Promise<string | null> {
  const store = getDataStore();
  const nowIso = new Date().toISOString();

  const retentionDoc = store.collection(learnerPaths.retentionScores()).doc(unitId);
  const existingRetention = await retentionDoc.get();
  if (!existingRetention || !retentionScoreSchema.safeParse(existingRetention).success) {
    await retentionDoc.set(
      retentionScoreConverter.toFirestore(
        retentionScoreSchema.parse({ ...initialRetention(unitId), passedAt: nowIso }),
      ),
    );
  }

  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const profileDoc = store.collection(learners).doc(learnerId);
  const rawProfile = await profileDoc.get();
  const profile = rawProfile ? learnerProfileSchema.safeParse(rawProfile) : null;
  // Advance only when the learner is actually standing on this unit
  // (a retake of an older unit never moves the profile).
  if (!profile?.success || profile.data.unitId !== unitId) return null;
  const index = seedUnits.findIndex((unit) => unit.id === unitId);
  const next = seedUnits[index + 1];
  if (!next || next.level !== profile.data.level) return null;
  await profileDoc.set(
    learnerProfileConverter.toFirestore(
      learnerProfileSchema.parse({ ...profile.data, unitId: next.id }),
    ),
  );
  return next.id;
}

export async function submitUnitTest(rawInput: unknown): Promise<SubmissionOutcome> {
  const input = submissionInput.parse(rawInput);
  const outcomes = scoreUnitTest(input.test, {
    listening: input.listening,
    reading: input.reading,
    writing: input.writing as ProductionRubricResult,
    speaking: input.speaking as ProductionRubricResult,
  });
  const nowIso = new Date().toISOString();
  for (const outcome of outcomes) {
    await recordSkillScore(getDataStore(), input.test.unitId, outcome.skill, outcome.score, nowIso);
  }
  const progress = startUnitProgress(input.test.unitId, outcomes);
  await saveProgress(progress);
  const complete = unitComplete(progress);
  const advancedToUnitId = complete ? await onUnitComplete(input.test.unitId) : null;
  return { progress: toDoc(progress), complete, advancedToUnitId };
}

export async function markRemediationDone(unitId: string, skill: Skill): Promise<UnitProgressDoc> {
  const doc = await loadUnitProgress(unitId);
  if (!doc) throw new Error(`No unit progress for ${unitId}.`);
  const progress = completeRemediationPure(fromDoc(doc), skill);
  await saveProgress(progress);
  return toDoc(progress);
}

const retakeInput = z.object({
  unitId: z.string().min(1),
  skill: z.enum(['listening', 'reading', 'writing', 'speaking']),
  test: unitTestSchema,
  objective: z.array(z.boolean()).nullable(),
  production: z
    .object({
      errorCount: z.number().int().nonnegative(),
      contentPointsCovered: z.number().int().nonnegative(),
      contentPointsTotal: z.number().int().positive(),
    })
    .nullable(),
});

export async function submitRetake(rawInput: unknown): Promise<SubmissionOutcome> {
  const input = retakeInput.parse(rawInput);
  const doc = await loadUnitProgress(input.unitId);
  if (!doc) throw new Error(`No unit progress for ${input.unitId}.`);

  const outcomes = scoreUnitTest(input.test, {
    listening:
      input.skill === 'listening' && input.objective
        ? input.objective
        : input.test.listening.map(() => true),
    reading:
      input.skill === 'reading' && input.objective
        ? input.objective
        : input.test.reading.map(() => true),
    writing:
      input.skill === 'writing' && input.production
        ? input.production
        : { errorCount: 0, contentPointsCovered: 3, contentPointsTotal: 3 },
    speaking:
      input.skill === 'speaking' && input.production
        ? input.production
        : { errorCount: 0, contentPointsCovered: 2, contentPointsTotal: 2 },
  });
  const retakeScore = outcomes.find((outcome) => outcome.skill === input.skill);
  if (!retakeScore) throw new Error('Retake skill missing from outcomes.');

  const nowIso = new Date().toISOString();
  await recordSkillScore(getDataStore(), input.unitId, input.skill, retakeScore.score, nowIso);
  const progress = applyRetake(fromDoc(doc), input.skill, retakeScore.score);
  await saveProgress(progress);
  const complete = unitComplete(progress);
  const advancedToUnitId = complete ? await onUnitComplete(input.unitId) : null;
  return { progress: toDoc(progress), complete, advancedToUnitId };
}
