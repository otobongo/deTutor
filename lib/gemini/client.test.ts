import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TUTOR_SYSTEM_PROMPT } from '@/lib/prompts/tutor-system-prompt';
import { createGeminiClient, GeminiError, type GeminiTransport } from './client';

interface RecordedRequest {
  model: string;
  systemInstruction: string;
  jsonMode: boolean;
}

function fakeTransport(responses: Array<string | Error>) {
  const requests: RecordedRequest[] = [];
  const transport: GeminiTransport = {
    generate: ({ model, systemInstruction, jsonMode }) => {
      requests.push({ model, systemInstruction, jsonMode });
      const next = responses.shift();
      if (next === undefined) throw new Error('fake transport exhausted');
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    },
  };
  return { transport, requests };
}

const messages = [{ role: 'learner', text: 'Wie sagt man "table"?' }] as const;
const models = { fast: 'fast-model', deep: 'deep-model' } as const;
const noopLogger = () => {};
const opts = { callSite: 'scenario-turn' } as const;

describe('Gemini client (GT-109)', () => {
  it('attaches the canonical system prompt to every call', async () => {
    const { transport, requests } = fakeTransport(['Der Tisch.']);
    const client = createGeminiClient(transport, models, noopLogger);
    await client.chat(messages, opts);
    expect(requests[0]?.systemInstruction).toBe(TUTOR_SYSTEM_PROMPT);
    expect(requests[0]?.model).toBe('fast-model');
  });

  it('injects scenario context as a layer, never replacing the prompt', async () => {
    const { transport, requests } = fakeTransport(['Guten Tag!']);
    const client = createGeminiClient(transport, models, noopLogger);
    await client.chat(messages, { ...opts, context: 'You are a barista in a Berlin café.' });
    const instruction = requests[0]?.systemInstruction ?? '';
    expect(instruction.startsWith(TUTOR_SYSTEM_PROMPT)).toBe(true);
    expect(instruction).toContain('SCENARIO CONTEXT');
    expect(instruction).toContain('barista');
  });

  it('returns typed JSON when the schema validates', async () => {
    const { transport, requests } = fakeTransport(['{"verdict":"full"}']);
    const client = createGeminiClient(transport, models, noopLogger);
    const schema = z.object({ verdict: z.enum(['full', 'partial', 'missed']) });
    await expect(client.generateJson(messages, schema, opts)).resolves.toEqual({ verdict: 'full' });
    expect(requests[0]?.jsonMode).toBe(true);
  });

  it('retries malformed JSON exactly once, then fails with parse-failure', async () => {
    const { transport, requests } = fakeTransport(['not json', 'still not json']);
    const client = createGeminiClient(transport, models, noopLogger);
    const schema = z.object({ ok: z.boolean() });
    const failure = await client
      .generateJson(messages, schema, opts)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).category).toBe('parse-failure');
    expect(requests).toHaveLength(2);
  });

  it('recovers when the retry returns valid JSON', async () => {
    const { transport, requests } = fakeTransport(['nope', '{"ok":true}']);
    const client = createGeminiClient(transport, models, noopLogger);
    const schema = z.object({ ok: z.boolean() });
    await expect(client.generateJson(messages, schema, opts)).resolves.toEqual({ ok: true });
    expect(requests).toHaveLength(2);
  });

  it.each([
    ['rate-limit', Object.assign(new Error('quota exceeded'), { status: 429 })],
    ['safety-block', new Error('response blocked by safety settings')],
    ['network', new Error('fetch failed: ECONNRESET')],
  ] as const)('categorizes %s errors distinctly', async (category, thrown) => {
    const { transport } = fakeTransport([thrown]);
    const client = createGeminiClient(transport, models, noopLogger);
    const failure = await client.chat(messages, opts).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).category).toBe(category);
  });
});
