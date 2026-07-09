import { describe, expect, it } from 'vitest';
import { createGeminiClient, GeminiError, type GeminiTransport } from '@/lib/gemini/client';
import type { GeminiCallLogEntry } from '@/lib/gemini/client';
import { evaluateListening } from './listening-eval';

const verdictJson = JSON.stringify({
  verdict: 'partial',
  missedPoints: ['the time of departure'],
  feedback: 'You caught the cancellation, well heard.',
});

const nuanceJson = JSON.stringify({
  nuances: [{ kind: 'register', explanation: '"fällt aus" is neutral announcement register.' }],
});

function clientWith(responses: Array<string | Error>) {
  const logs: GeminiCallLogEntry[] = [];
  const transport: GeminiTransport = {
    generate: () => {
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
  const client = createGeminiClient(
    transport,
    { fast: 'fast-model', deep: 'deep-model' },
    (entry) => logs.push(entry),
  );
  return { client, logs };
}

const input = {
  clipText: 'Der Zug nach München fällt heute aus.',
  learnerResponse: 'The train is cancelled.',
};

describe('listening evaluation (GT-206)', () => {
  it('returns a closed-union verdict with missed points', async () => {
    const { client } = clientWith([verdictJson]);
    const evaluation = await evaluateListening(client, { ...input, level: 'A1' });
    expect(['full', 'partial', 'missed']).toContain(evaluation.verdict.verdict);
    expect(evaluation.verdict.missedPoints).toEqual(['the time of departure']);
    expect(evaluation.nuance).toBeNull();
  });

  it('uses the fast tier at A1 and adds a deep nuance pass at B1', async () => {
    const a1 = clientWith([verdictJson]);
    await evaluateListening(a1.client, { ...input, level: 'A1' });
    expect(a1.logs.map((log) => log.tier)).toEqual(['fast']);

    const b1 = clientWith([verdictJson, nuanceJson]);
    const evaluation = await evaluateListening(b1.client, { ...input, level: 'B1' });
    expect(b1.logs.map((log) => log.tier)).toEqual(['fast', 'deep']);
    expect(b1.logs[1]?.callSite).toBe('listening-nuance-b1');
    expect(evaluation.nuance?.nuances[0]?.kind).toBe('register');
  });

  it('surfaces a categorized parse-failure instead of crashing', async () => {
    const { client } = clientWith(['garbage', 'still garbage']);
    const failure = await evaluateListening(client, { ...input, level: 'A1' }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).category).toBe('parse-failure');
  });

  it('rejects an out-of-union verdict from the model', async () => {
    const bad = JSON.stringify({ verdict: 'excellent', missedPoints: [], feedback: 'x' });
    const { client } = clientWith([bad, bad]);
    const failure = await evaluateListening(client, { ...input, level: 'A2' }).catch(
      (error: unknown) => error,
    );
    expect((failure as GeminiError).category).toBe('parse-failure');
  });
});
