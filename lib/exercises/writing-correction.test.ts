import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DevFileStore } from '@/lib/db/store';
import { loadGrammarErrors } from '@/lib/analytics/grammar-log';
import {
  createGeminiClient,
  GeminiError,
  type GeminiCallLogEntry,
  type GeminiTransport,
} from '@/lib/gemini/client';
import { WRITING_PROMPTS, type WritingPrompt } from './composers';
import { correctWriting, logCorrectionErrors } from './writing-correction';

const emailPrompt = WRITING_PROMPTS[0] as WritingPrompt;

const fixtureCorrection = JSON.stringify({
  whatWorks: 'Your greeting and closing are natural.',
  correctedText: 'Hallo Alex! Kannst du mir helfen? Am Samstag habe ich Zeit.',
  errors: [
    {
      category: 'case',
      original: 'Kannst du mich helfen?',
      corrected: 'Kannst du mir helfen?',
      explanation: 'helfen takes the Dativ: mir, not mich.',
    },
    {
      category: 'order',
      original: 'Am Samstag ich habe Zeit.',
      corrected: 'Am Samstag habe ich Zeit.',
      explanation: 'Verb second: the verb stays in position two.',
    },
  ],
  patternTakeaway: 'Dativ verbs (helfen, danken) always take mir/dir.',
  contentPointsCovered: [true, false, true],
});

function clientWith(responses: string[]) {
  const logs: GeminiCallLogEntry[] = [];
  const transport: GeminiTransport = {
    generate: () => {
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
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
  text: 'Hallo Alex! Kannst du mich helfen? Am Samstag ich habe Zeit.',
  format: 'email' as const,
  contentPoints: emailPrompt.contentPoints,
};

describe('writing correction engine (GT-213)', () => {
  it('returns the four-part structure with a planted Dativ error as category case', async () => {
    const { client } = clientWith([fixtureCorrection]);
    const correction = await correctWriting(client, input);
    expect(correction.whatWorks.length).toBeGreaterThan(0);
    expect(correction.correctedText).toContain('mir');
    expect(correction.errors[0]?.category).toBe('case');
    expect(correction.patternTakeaway).toContain('Dativ');
    expect(correction.contentPointsCovered).toEqual([true, false, true]);
  });

  it('runs on the deep tier', async () => {
    const { client, logs } = clientWith([fixtureCorrection]);
    await correctWriting(client, input);
    expect(logs[0]?.tier).toBe('deep');
    expect(logs[0]?.callSite).toBe('writing-correction');
  });

  it('writes every categorized error to the grammar log', async () => {
    const { client } = clientWith([fixtureCorrection]);
    const correction = await correctWriting(client, input);
    const dir = mkdtempSync(path.join(tmpdir(), 'writing-log-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      const count = await logCorrectionErrors(store, correction, '2026-07-09T08:00:00.000Z');
      expect(count).toBe(2);
      const entries = await loadGrammarErrors(store);
      expect(entries.map((entry) => entry.category).sort()).toEqual(['case', 'order']);
      expect(entries.every((entry) => entry.context.includes('->'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('retries once on a schema violation then fails gracefully typed', async () => {
    const invalid = JSON.stringify({ whatWorks: 'x' });
    const { client } = clientWith([invalid, invalid]);
    const failure = await correctWriting(client, input).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).category).toBe('parse-failure');
  });

  it('rejects an out-of-union error category', async () => {
    const badCategory = fixtureCorrection.replace('"case"', '"vocabulary"');
    const { client } = clientWith([badCategory, badCategory]);
    const failure = await correctWriting(client, input).catch((error: unknown) => error);
    expect((failure as GeminiError).category).toBe('parse-failure');
  });
});
