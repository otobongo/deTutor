import { describe, expect, it } from 'vitest';
import { seedScenarios } from '@/db/seed/scenarios';
import type { Scenario } from '@/lib/db/curriculum';
import { createGeminiClient, type GeminiTransport } from '@/lib/gemini/client';
import {
  buildScenarioContext,
  ENGLISH_REDIRECT,
  looksEnglish,
  runScenarioTurn,
  scoreScenario,
  startScenario,
} from './engine';

const cafe = seedScenarios.find((scenario) => scenario.id === 'cafe') as Scenario;

function clientWith(responses: string[]) {
  const contexts: Array<string | undefined> = [];
  const transport: GeminiTransport = {
    generate: ({ systemInstruction }) => {
      contexts.push(systemInstruction);
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  return { client: createGeminiClient(transport, { fast: 'f', deep: 'd' }, () => {}), contexts };
}

const germanTurn = JSON.stringify({ reply: 'Gern! Mit Milch?', correction: null });

describe('scenario engine (GT-216)', () => {
  it('seeds the six A1/A2 scenarios', () => {
    const a1a2 = seedScenarios.filter((scenario) => scenario.level !== 'B1');
    expect(a1a2.map((scenario) => scenario.id).sort()).toEqual([
      'cafe',
      'directions',
      'doctor',
      'introductions',
      'supermarkt',
      'u-bahn',
    ]);
  });

  it('injects the scenario as context on top of the canonical prompt, level-capped', async () => {
    const { client, contexts } = clientWith([germanTurn]);
    const state = startScenario(cafe, 'A1', 'hochdeutsch');
    const { turn } = await runScenarioTurn(client, state, 'Einen Kaffee, bitte.');
    expect(turn.reply).toBe('Gern! Mit Milch?');
    const instruction = contexts[0] ?? '';
    expect(instruction).toContain('SCENARIO CONTEXT');
    expect(instruction).toContain('barista');
    expect(instruction).toContain('max 8 words');
  });

  it('does not redirect the first English input, redirects clearly by the second', async () => {
    const { client } = clientWith([germanTurn]);
    let state = startScenario(cafe, 'A1', 'hochdeutsch');
    const first = await runScenarioTurn(client, state, 'Can I have a coffee please?');
    expect(first.turn.reply).not.toBe(ENGLISH_REDIRECT);
    state = first.state;
    const second = await runScenarioTurn(client, state, 'I want it with milk, thanks.');
    expect(second.turn.reply).toBe(ENGLISH_REDIRECT);
    expect(second.state.redirected).toBe(true);
  });

  it('a German turn resets the English streak', async () => {
    const { client } = clientWith([germanTurn, germanTurn]);
    let state = startScenario(cafe, 'A1', 'hochdeutsch');
    state = (await runScenarioTurn(client, state, 'Can I have a coffee?')).state;
    state = (await runScenarioTurn(client, state, 'Einen Kaffee, bitte.')).state;
    expect(state.englishStreak).toBe(0);
  });

  it('completion emits a 0 to 10 score with a takeaway', async () => {
    const { client } = clientWith([
      germanTurn,
      JSON.stringify({ score: 7, takeaway: 'Articles first: der Kaffee, die Milch.' }),
    ]);
    let state = startScenario(cafe, 'A1', 'hochdeutsch');
    state = (await runScenarioTurn(client, state, 'Einen Kaffee, bitte.')).state;
    const score = await scoreScenario(client, state);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(10);
    expect(score.takeaway.length).toBeGreaterThan(0);
  });

  it('collects structured inline corrections without breaking the scene', async () => {
    const withCorrection = JSON.stringify({
      reply: 'Fast! Besser: Ich hätte gern einen Kaffee. Der Kaffee kommt sofort!',
      correction: {
        acknowledgment: 'Fast!',
        better: 'Ich hätte gern einen Kaffee.',
        reason: 'Kaffee is masculine: einen Kaffee in the Akkusativ.',
        category: 'gender',
        item: 'der Kaffee',
      },
    });
    const { client } = clientWith([withCorrection]);
    const { state, turn } = await runScenarioTurn(
      client,
      startScenario(cafe, 'A1', 'hochdeutsch'),
      'Ich möchte eine Kaffee.',
    );
    expect(turn.correction?.category).toBe('gender');
    expect(turn.reply.length).toBeGreaterThan(0);
    expect(state.corrections).toHaveLength(1);
  });

  it('detects English deterministically without tripping on German', () => {
    expect(looksEnglish('Can you help me please?')).toBe(true);
    expect(looksEnglish('Einen Kaffee, bitte.')).toBe(false);
    expect(looksEnglish('Ich möchte das Sandwich.')).toBe(false);
  });
});

describe('scenario context (GT-216)', () => {
  it('carries dialect mode into the context', () => {
    const berlin = buildScenarioContext(cafe, 'A1', 'berlin');
    expect(berlin).toContain('Berlin dialect mode');
    const hoch = buildScenarioContext(cafe, 'A1', 'hochdeutsch');
    expect(hoch).toContain('Hochdeutsch');
  });
});
