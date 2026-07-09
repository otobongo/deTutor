import { z } from 'zod';
import type { Level, Scenario } from '@/lib/db/curriculum';
import { grammarErrorCategorySchema } from '@/lib/db/learner';
import type { Dialect } from '@/lib/db/learner';
import type { ChatMessage, GeminiClient } from '@/lib/gemini/client';

// Scenario runtime (GT-216). The scenario is a Layer-3 context injected on
// top of the canonical system prompt (never a fork); the turn loop returns
// structured replies so inline corrections (GT-218) ride along without
// breaking the scene. English redirect fires deterministically by the
// second English learner turn.

const SENTENCE_CAP_BY_LEVEL: Readonly<Record<Level, string>> = {
  A1: 'Very short sentences (max 8 words), present tense, high-frequency words only.',
  A2: 'Short sentences, everyday vocabulary, Perfekt and Dativ allowed.',
  B1: 'Natural complexity: subordinate clauses and register appropriate to the setting.',
};

export function buildScenarioContext(scenario: Scenario, level: Level, dialect: Dialect): string {
  return [
    `SCENARIO: ${scenario.title}`,
    `Setting: ${scenario.setting}`,
    `You play: ${scenario.personaDescription}`,
    `Learner level: ${level}. ${SENTENCE_CAP_BY_LEVEL[level]}`,
    dialect === 'berlin'
      ? 'Berlin dialect mode is on: layer in labeled Berlin expressions per your dialect rule.'
      : 'Use standard Hochdeutsch.',
    'Stay in the scene. Apply your inline correction rule to learner errors.',
  ].join('\n');
}

export const scenarioTurnSchema = z.object({
  reply: z.string().min(1),
  correction: z
    .object({
      acknowledgment: z.enum(['Gut!', 'Fast!']),
      better: z.string().min(1),
      reason: z.string().min(1),
      category: grammarErrorCategorySchema,
      item: z.string().min(1),
    })
    .nullable(),
});
export type ScenarioTurn = z.infer<typeof scenarioTurnSchema>;

export interface ScenarioState {
  readonly scenario: Scenario;
  readonly level: Level;
  readonly dialect: Dialect;
  readonly messages: readonly ChatMessage[];
  readonly corrections: readonly ScenarioTurn['correction'][];
  readonly englishStreak: number;
  readonly redirected: boolean;
}

export function startScenario(scenario: Scenario, level: Level, dialect: Dialect): ScenarioState {
  return {
    scenario,
    level,
    dialect,
    messages: [],
    corrections: [],
    englishStreak: 0,
    redirected: false,
  };
}

const COMMON_ENGLISH_WORDS = new Set([
  'the',
  'i',
  'you',
  'is',
  'are',
  'and',
  'to',
  'a',
  'of',
  'it',
  'that',
  'have',
  'do',
  'can',
  'what',
  'my',
  'this',
  'want',
  'like',
  'please',
  'thanks',
  'yes',
  'no',
  'sorry',
  'hello',
  'would',
  'could',
  'me',
  'we',
  'they',
]);

// Deterministic English detection: majority of tokens being common English
// words marks the turn as English. German loanwords do not trip it.
export function looksEnglish(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return false;
  const englishCount = tokens.filter((token) => COMMON_ENGLISH_WORDS.has(token)).length;
  return englishCount / tokens.length >= 0.5;
}

export const ENGLISH_REDIRECT = '[English: Try it in German, even one word. I will help.]';

export async function runScenarioTurn(
  client: GeminiClient,
  state: ScenarioState,
  learnerInput: string,
): Promise<{ state: ScenarioState; turn: ScenarioTurn }> {
  const isEnglish = looksEnglish(learnerInput);
  const englishStreak = isEnglish ? state.englishStreak + 1 : 0;

  // Redirect clearly by the second English response, without a model call:
  // the redirect is fixed by the system prompt's wording.
  if (isEnglish && englishStreak >= 2) {
    const turn: ScenarioTurn = { reply: ENGLISH_REDIRECT, correction: null };
    return {
      state: {
        ...state,
        englishStreak,
        redirected: true,
        messages: [
          ...state.messages,
          { role: 'learner', text: learnerInput },
          { role: 'tutor', text: turn.reply },
        ],
      },
      turn,
    };
  }

  const messages: ChatMessage[] = [...state.messages, { role: 'learner', text: learnerInput }];
  const turn = await client.generateJson(messages, scenarioTurnSchema, {
    callSite: 'scenario-turn',
    context: buildScenarioContext(state.scenario, state.level, state.dialect),
  });
  return {
    state: {
      ...state,
      englishStreak,
      messages: [...messages, { role: 'tutor', text: turn.reply }],
      corrections: turn.correction ? [...state.corrections, turn.correction] : state.corrections,
    },
    turn,
  };
}

export const scenarioScoreSchema = z.object({
  score: z.number().int().min(0).max(10),
  takeaway: z.string().min(1),
});
export type ScenarioScore = z.infer<typeof scenarioScoreSchema>;

export async function scoreScenario(
  client: GeminiClient,
  state: ScenarioState,
): Promise<ScenarioScore> {
  return client.generateJson(
    [
      ...state.messages,
      {
        role: 'learner',
        text:
          'The scenario is over. Score my German in this conversation 0 to 10 (honest, never ' +
          'inflated) and give the single most important takeaway. ' +
          'Return JSON: {"score":0-10,"takeaway":string}.',
      },
    ],
    scenarioScoreSchema,
    {
      callSite: 'scenario-turn',
      context: buildScenarioContext(state.scenario, state.level, state.dialect),
    },
  );
}
