import { describe, expect, it } from 'vitest';
import { createGeminiClient, type GeminiTransport } from '@/lib/gemini/client';
import { createMediaProvider } from '@/lib/media';
import { assessEchoAttempt, moveOnLogEntry, startEchoLoop } from './speaking-echo';

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

const closeAssessment = JSON.stringify({
  verdict: 'close',
  missingSounds: ['ch (ich-sound)'],
  stressNote: 'Stress the first syllable: BRÖT-chen.',
  encouragement: 'Almost there, the vowel was lovely.',
});

const offAssessment = JSON.stringify({
  verdict: 'off',
  missingSounds: ['ö', 'ch'],
  stressNote: null,
  encouragement: 'Good try, this one is tricky.',
});

describe('speaking echo loop (GT-215)', () => {
  it('confirms an exact transcript without a model call', async () => {
    const client = clientWith([]);
    const state = await assessEchoAttempt(client, startEchoLoop('das Brötchen'), 'das Brötchen!');
    expect(state.status).toBe('confirmed');
    expect(state.lastAssessment?.verdict).toBe('correct');
  });

  it('a near-miss offers a retry naming the specific issue', async () => {
    const client = clientWith([closeAssessment]);
    const state = await assessEchoAttempt(client, startEchoLoop('das Brötchen'), 'das Brotchen');
    expect(state.status).toBe('awaiting-response');
    expect(state.lastAssessment?.missingSounds).toContain('ch (ich-sound)');
    expect(state.lastAssessment?.stressNote).toContain('BRÖT');
  });

  it('confirms when close after a genuine retry instead of drilling forever', async () => {
    const client = clientWith([closeAssessment, closeAssessment]);
    let state = await assessEchoAttempt(client, startEchoLoop('das Brötchen'), 'das Brotchen');
    state = await assessEchoAttempt(client, state, 'das Bröt-chen');
    expect(state.status).toBe('confirmed');
  });

  it('three misses move on kindly and log the pronunciation item', async () => {
    const client = clientWith([offAssessment, offAssessment, offAssessment]);
    let state = startEchoLoop('das Brötchen');
    state = await assessEchoAttempt(client, state, 'das Brot');
    state = await assessEchoAttempt(client, state, 'das Broten');
    state = await assessEchoAttempt(client, state, 'das Brotken');
    expect(state.status).toBe('moved-on');
    expect(state.attempts).toBe(3);
    const entry = moveOnLogEntry(state, '2026-07-09T08:00:00.000Z');
    expect(entry?.item).toBe('pronunciation:das Brötchen');
    expect(entry?.context).toContain('3 attempts');
    expect(state.lastAssessment?.encouragement.length).toBeGreaterThan(0);
  });

  it('runs fully in placeholder mode: tutor audio comes from the adapter', async () => {
    const provider = createMediaProvider('placeholder');
    const asset = await provider.getAudio('echo-das-broetchen');
    expect(asset.captionsRequired).toBe(true);
    const session = await provider.getLiveVoiceSession({
      voice: 'warm-1',
      dialect: 'hochdeutsch',
      scenarioContext: null,
    });
    expect(session.mode).toBe('fallback-text');
    session.end();
  });

  it('refuses input after the loop finished', async () => {
    const client = clientWith([]);
    const confirmed = await assessEchoAttempt(client, startEchoLoop('Hallo'), 'Hallo');
    await expect(assessEchoAttempt(client, confirmed, 'Hallo')).rejects.toThrow(/already finished/);
  });
});
