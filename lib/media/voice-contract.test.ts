import { describe, expect, it } from 'vitest';
import { FallbackVoiceSession } from './fallback-voice-session';
import { GeminiLiveVoiceSession, type LiveHandlers } from './live-voice-session';
import { MediaProviderError } from './provider';
import type { VoiceConfig, VoiceSession, VoiceSessionEvent } from './provider';

// GT-503 contract test: the event shape is IDENTICAL between the fallback
// session and the Gemini Live session. The same assertions run against both
// implementations; a divergence fails here before it reaches a feature.

const config: VoiceConfig = { voice: 'warm-1', dialect: 'hochdeutsch', scenarioContext: null };

function fakeLiveSession(): Promise<{ session: VoiceSession; drive: LiveHandlers }> {
  let handlers: LiveHandlers | null = null;
  return GeminiLiveVoiceSession.connect(config, (_config, h) => {
    handlers = h;
    return Promise.resolve({ sendText: () => {}, close: () => {} });
  }).then((session) => ({ session, drive: handlers as unknown as LiveHandlers }));
}

type SessionFactory = () => Promise<{ session: VoiceSession; drive: LiveHandlers | null }>;

const factories: ReadonlyArray<[string, SessionFactory]> = [
  [
    'fallback-text (GT-007)',
    () => Promise.resolve({ session: new FallbackVoiceSession(config), drive: null }),
  ],
  ['live-voice (GT-503)', () => fakeLiveSession()],
];

describe.each(factories)('voice session contract: %s', (_name, factory) => {
  it('learner input emits learnerInput then a learner transcript, same shape', async () => {
    const { session } = await factory();
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.sendLearnerInput('Ich hätte gern einen Kaffee.');
    expect(events).toEqual([
      { type: 'learnerInput', text: 'Ich hätte gern einen Kaffee.' },
      { type: 'transcript', role: 'learner', text: 'Ich hätte gern einen Kaffee.' },
    ]);
  });

  it('tutor turns emit tutor transcripts, same shape', async () => {
    const { session } = await factory();
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.sendTutorTurn('Gern! Mit Milch?');
    expect(events).toEqual([{ type: 'transcript', role: 'tutor', text: 'Gern! Mit Milch?' }]);
  });

  it('end emits exactly once and later input fails loudly', async () => {
    const { session } = await factory();
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    session.end();
    session.end();
    expect(events).toEqual([{ type: 'end' }]);
    expect(() => session.sendLearnerInput('Hallo?')).toThrow(MediaProviderError);
  });

  it('unsubscribe stops delivery', async () => {
    const { session } = await factory();
    const events: VoiceSessionEvent[] = [];
    const unsubscribe = session.on((event) => events.push(event));
    unsubscribe();
    session.sendTutorTurn('Hallo!');
    expect(events).toEqual([]);
  });
});

describe('live-session specifics (GT-503)', () => {
  it('recognized speech from the transport populates the correction pipeline events', async () => {
    const { session, drive } = await fakeLiveSession();
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    drive.onLearnerTranscript('Ich möchte eine Kaffee.');
    drive.onTutorTranscript('Fast! Besser: einen Kaffee.');
    expect(events).toEqual([
      { type: 'learnerInput', text: 'Ich möchte eine Kaffee.' },
      { type: 'transcript', role: 'learner', text: 'Ich möchte eine Kaffee.' },
      { type: 'transcript', role: 'tutor', text: 'Fast! Besser: einen Kaffee.' },
    ]);
  });

  it('a transport close ends the session through the same end event', async () => {
    const { session, drive } = await fakeLiveSession();
    const events: VoiceSessionEvent[] = [];
    session.on((event) => events.push(event));
    drive.onClose();
    expect(events).toEqual([{ type: 'end' }]);
    expect(session.mode).toBe('live-voice');
  });
});
