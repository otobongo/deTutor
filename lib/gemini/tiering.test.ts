import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '@/lib/config';
import {
  createGeminiClient,
  ESCALATION_MAP,
  type GeminiCallLogEntry,
  type GeminiTransport,
} from './client';

function instrumentedClient() {
  const calls: Array<{ model: string }> = [];
  const logs: GeminiCallLogEntry[] = [];
  const transport: GeminiTransport = {
    generate: ({ model }) => {
      calls.push({ model });
      return Promise.resolve('ok');
    },
  };
  const client = createGeminiClient(
    transport,
    { fast: 'fast-model', deep: 'deep-model' },
    (entry) => logs.push(entry),
  );
  return { client, calls, logs };
}

const messages = [{ role: 'learner', text: 'Hallo' }] as const;

describe('model tiering (GT-110)', () => {
  it('routes scenario turns to the fast model by default', async () => {
    const { client, calls, logs } = instrumentedClient();
    await client.chat(messages, { callSite: 'scenario-turn' });
    expect(calls[0]?.model).toBe('fast-model');
    expect(logs[0]?.tier).toBe('fast');
  });

  it('escalates writing correction to the deep model', async () => {
    const { client, calls, logs } = instrumentedClient();
    await client.chat(messages, { callSite: 'writing-correction' });
    expect(calls[0]?.model).toBe('deep-model');
    expect(logs[0]?.tier).toBe('deep');
  });

  it('maps exactly the four planned deep call sites', () => {
    const deepSites = Object.entries(ESCALATION_MAP)
      .filter(([, tier]) => tier === 'deep')
      .map(([site]) => site)
      .sort();
    expect(deepSites).toEqual([
      'listening-nuance-b1',
      'unit-test-generation',
      'weekly-summary',
      'writing-correction',
    ]);
  });

  it('logs call site, tier, and model for every call', async () => {
    const { client, logs } = instrumentedClient();
    await client.chat(messages, { callSite: 'listening-nuance-b1' });
    expect(logs).toEqual([
      { callSite: 'listening-nuance-b1', tier: 'deep', model: 'deep-model', jsonMode: false },
    ]);
  });

  it('fails at startup, not mid-call, when the deep model string is missing', () => {
    expect(() =>
      loadConfig({
        FIREBASE_PROJECT_ID: 'p',
        FIREBASE_CLIENT_EMAIL: 'e@example.com',
        FIREBASE_PRIVATE_KEY: 'k',
        GEMINI_API_KEY: 'key',
        GEMINI_MODEL_DEEP: '',
      }),
    ).toThrow(ConfigError);
  });
});
