'use server';

import { z } from 'zod';
import { seedScenarios } from '@/db/seed/scenarios';
import { LEVELS, type Scenario } from '@/lib/db/curriculum';
import { grammarErrorCategorySchema } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import {
  runScenarioTurn,
  scoreScenario,
  startScenario,
  type ScenarioState,
  type ScenarioTurn,
} from '@/lib/scenarios/engine';
import { buildScenarioSummary, logScenarioCorrections } from '@/lib/scenarios/summary';
import type { ScenarioSummary } from '@/lib/scenarios/summary';
import { GeminiError, getGeminiClient } from '@/lib/gemini/client';

// Scenario slot actions. The engine state is rebuilt from a serializable
// snapshot each turn (the scenario itself comes from the seed by id), so the
// client never holds anything but data. Content stays at the learner's level:
// an A1 profile only ever sees A1 scenarios.

const chatMessageSchema = z.object({
  role: z.enum(['learner', 'tutor']),
  text: z.string().min(1),
});

const scenarioSnapshotSchema = z.object({
  scenarioId: z.string().min(1),
  messages: z.array(chatMessageSchema),
  corrections: z.array(
    z.object({
      acknowledgment: z.enum(['Gut!', 'Fast!']),
      better: z.string().min(1),
      reason: z.string().min(1),
      category: grammarErrorCategorySchema,
      item: z.string().min(1),
      original: z.string().min(1),
    }),
  ),
  englishStreak: z.number().int().nonnegative(),
  redirected: z.boolean(),
});
export type ScenarioSnapshot = z.infer<typeof scenarioSnapshotSchema>;

function snapshotOf(state: ScenarioState): ScenarioSnapshot {
  return {
    scenarioId: state.scenario.id,
    messages: [...state.messages],
    corrections: [...state.corrections],
    englishStreak: state.englishStreak,
    redirected: state.redirected,
  };
}

async function rebuildState(rawSnapshot: unknown): Promise<ScenarioState | null> {
  const snapshot = scenarioSnapshotSchema.parse(rawSnapshot);
  const scenario = seedScenarios.find((candidate) => candidate.id === snapshot.scenarioId);
  const profile = await loadLearnerProfile(getDataStore());
  if (!scenario || !profile) return null;
  return {
    ...startScenario(scenario, profile.level, profile.settings.dialect),
    messages: snapshot.messages,
    corrections: snapshot.corrections,
    englishStreak: snapshot.englishStreak,
    redirected: snapshot.redirected,
  };
}

export interface ScenarioStartPayload {
  readonly scenario: Scenario;
  readonly snapshot: ScenarioSnapshot;
}

// Deterministic pick among the scenarios at or below the learner's level,
// rotating by day so repeat sessions vary without RNG.
export async function getScenarioForTodayAction(): Promise<ScenarioStartPayload | null> {
  const profile = await loadLearnerProfile(getDataStore());
  if (!profile) return null;
  const levelIndex = LEVELS.indexOf(profile.level);
  const eligible = seedScenarios.filter((scenario) => LEVELS.indexOf(scenario.level) <= levelIndex);
  if (eligible.length === 0) return null;
  const dayOrdinal = Math.floor(Date.now() / 86_400_000);
  const scenario = eligible[dayOrdinal % eligible.length] as Scenario;
  return {
    scenario,
    snapshot: snapshotOf(startScenario(scenario, profile.level, profile.settings.dialect)),
  };
}

export type ScenarioTurnOutcome =
  | { readonly ok: true; readonly turn: ScenarioTurn; readonly snapshot: ScenarioSnapshot }
  | { readonly ok: false; readonly category: string };

export async function scenarioTurnAction(
  rawSnapshot: unknown,
  learnerInput: string,
): Promise<ScenarioTurnOutcome> {
  const state = await rebuildState(rawSnapshot);
  if (!state) return { ok: false, category: 'parse-failure' };
  try {
    const result = await runScenarioTurn(getGeminiClient(), state, learnerInput);
    return { ok: true, turn: result.turn, snapshot: snapshotOf(result.state) };
  } catch (error) {
    if (error instanceof GeminiError) return { ok: false, category: error.category };
    throw error;
  }
}

export type ScenarioEndOutcome =
  | {
      readonly ok: true;
      readonly summary: ScenarioSummary;
      readonly score: number;
      readonly errorsLogged: number;
    }
  | { readonly ok: false; readonly category: string; readonly errorsLogged: number };

// Ending always logs the collected corrections (they are real observations
// regardless of scoring); the 0-10 score needs the brain and is reported as
// unavailable when it cannot be produced.
export async function endScenarioAction(rawSnapshot: unknown): Promise<ScenarioEndOutcome> {
  const state = await rebuildState(rawSnapshot);
  if (!state) return { ok: false, category: 'parse-failure', errorsLogged: 0 };
  const store = getDataStore();
  const errorsLogged = await logScenarioCorrections(store, state, new Date().toISOString());
  try {
    const score = await scoreScenario(getGeminiClient(), state);
    return {
      ok: true,
      summary: buildScenarioSummary(state, score),
      score: score.score,
      errorsLogged,
    };
  } catch (error) {
    if (error instanceof GeminiError) {
      return { ok: false, category: error.category, errorsLogged };
    }
    throw error;
  }
}
