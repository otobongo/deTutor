import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { seedScenarios } from '@/db/seed/scenarios';
import type { Scenario } from '@/lib/db/curriculum';
import { DevFileStore } from '@/lib/db/store';
import { loadGrammarErrors } from '@/lib/analytics/grammar-log';
import { createGeminiClient, type GeminiTransport } from '@/lib/gemini/client';
import { runScenarioTurn, startScenario, type ScenarioState } from './engine';
import { buildScenarioSummary, logScenarioCorrections } from './summary';

const cafe = seedScenarios.find((scenario) => scenario.id === 'cafe') as Scenario;

const correctionTurn = JSON.stringify({
  reply: 'Fast! Besser: Ich hätte gern einen Kaffee. Kommt sofort!',
  correction: {
    acknowledgment: 'Fast!',
    better: 'Ich hätte gern einen Kaffee.',
    reason: 'Kaffee is masculine: einen Kaffee in the Akkusativ.',
    category: 'gender',
    item: 'der Kaffee',
  },
});

function clientWith(responses: string[]) {
  const transport: GeminiTransport = {
    generate: () => {
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  return createGeminiClient(transport, { fast: 'f', deep: 'd' }, () => {});
}

async function stateWithOneCorrection(): Promise<ScenarioState> {
  const client = clientWith([correctionTurn]);
  const { state } = await runScenarioTurn(
    client,
    startScenario(cafe, 'A1', 'hochdeutsch'),
    'Ich möchte eine Kaffee.',
  );
  return state;
}

describe('inline corrections and summary (GT-218)', () => {
  it('an error mid-scene yields Gut/Fast + Besser + reason and the scene continues', async () => {
    const state = await stateWithOneCorrection();
    const correction = state.corrections[0];
    expect(correction?.acknowledgment).toBe('Fast!');
    expect(correction?.better).toContain('einen Kaffee');
    expect(correction?.reason.split('.')[0]?.length).toBeGreaterThan(0);
    // The scene continued: the tutor reply is a scene line, not a lecture.
    expect(state.messages[state.messages.length - 1]?.text).toContain('Kommt sofort');
  });

  it('summary rows equal the corrections logged for the session', async () => {
    const state = await stateWithOneCorrection();
    const summary = buildScenarioSummary(state, {
      score: 6,
      takeaway: 'Watch masculine articles.',
    });
    expect(summary.rows).toEqual([
      {
        yourVersion: 'Ich möchte eine Kaffee.',
        correctVersion: 'Ich hätte gern einen Kaffee.',
        rule: 'Kaffee is masculine: einen Kaffee in the Akkusativ.',
      },
    ]);
    expect(summary.totalErrors).toBe(1);
    expect(summary.congratulation).toBeNull();

    const dir = mkdtempSync(path.join(tmpdir(), 'scenario-log-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      const logged = await logScenarioCorrections(store, state, '2026-07-09T08:00:00.000Z');
      const entries = await loadGrammarErrors(store);
      expect(logged).toBe(summary.rows.length);
      expect(entries).toHaveLength(summary.rows.length);
      expect(entries[0]?.category).toBe('gender');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a zero-error session congratulates without an empty table', () => {
    const clean = startScenario(cafe, 'A1', 'hochdeutsch');
    const summary = buildScenarioSummary(clean, { score: 9, takeaway: 'Keep going.' });
    expect(summary.rows).toEqual([]);
    expect(summary.congratulation).toContain('Fehlerfrei');
    expect(summary.takeaway).toBe('Keep going.');
  });
});
