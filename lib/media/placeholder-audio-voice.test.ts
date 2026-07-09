import { afterEach, describe, expect, it } from 'vitest';
import { clearPlaceholderClips, registerPlaceholderClip } from './placeholder-clips';
import { PlaceholderProvider } from './placeholder-provider';
import { MediaProviderError } from './provider';
import type { VoiceConfig, VoiceSessionEvent } from './provider';

const provider = new PlaceholderProvider();

const voiceConfig: VoiceConfig = {
  voice: 'warm-1',
  dialect: 'hochdeutsch',
  scenarioContext: null,
};

afterEach(() => {
  clearPlaceholderClips();
});

describe('placeholder audio (GT-007)', () => {
  it('resolves a registered clip to SpeechSynthesis de-DE with captions', async () => {
    registerPlaceholderClip('a1-1-greeting', 'Guten Morgen! Wie geht es dir?');
    const asset = await provider.getAudio('a1-1-greeting');
    expect(asset.source).toEqual({
      type: 'speech-synthesis',
      text: 'Guten Morgen! Wie geht es dir?',
      lang: 'de-DE',
    });
    expect(asset.captionsRequired).toBe(true);
    expect(asset.captionText).toBe('Guten Morgen! Wie geht es dir?');
  });

  it('degrades an unknown clip to a silent asset that triggers captions', async () => {
    const asset = await provider.getAudio('missing-clip');
    expect(asset.source).toEqual({ type: 'silent' });
    expect(asset.captionsRequired).toBe(true);
    expect(asset.captionText.length).toBeGreaterThan(0);
  });

  it('never throws when SpeechSynthesis is absent (server runtime has none)', async () => {
    await expect(provider.getAudio('anything')).resolves.toBeDefined();
  });
});

describe('fallback voice session (GT-007)', () => {
  it('emits transcript events from typed learner input', async () => {
    const session = await provider.getLiveVoiceSession(voiceConfig);
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.sendLearnerInput('Ich möchte einen Kaffee.');
    expect(events).toEqual([
      { type: 'learnerInput', text: 'Ich möchte einen Kaffee.' },
      { type: 'transcript', role: 'learner', text: 'Ich möchte einen Kaffee.' },
    ]);
  });

  it('emits tutor transcript events with the same shape', async () => {
    const session = await provider.getLiveVoiceSession(voiceConfig);
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.sendTutorTurn('Gerne! Mit Milch?');
    expect(events).toEqual([{ type: 'transcript', role: 'tutor', text: 'Gerne! Mit Milch?' }]);
  });

  it('runs in fallback-text mode and carries its config', async () => {
    const session = await provider.getLiveVoiceSession(voiceConfig);
    expect(session.mode).toBe('fallback-text');
    expect(session.config).toEqual(voiceConfig);
  });

  it('emits end exactly once and rejects input afterwards', async () => {
    const session = await provider.getLiveVoiceSession(voiceConfig);
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.end();
    session.end();
    expect(events).toEqual([{ type: 'end' }]);
    expect(() => session.sendLearnerInput('Hallo?')).toThrow(MediaProviderError);
  });

  it('unsubscribe stops event delivery', async () => {
    const session = await provider.getLiveVoiceSession(voiceConfig);
    const events: VoiceSessionEvent[] = [];
    const unsubscribe = session.on((event) => events.push(event));
    unsubscribe();
    session.sendTutorTurn('Hallo!');
    expect(events).toEqual([]);
  });
});
