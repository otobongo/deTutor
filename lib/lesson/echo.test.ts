import { describe, expect, it } from 'vitest';
import { advanceEcho, startEcho } from './echo';

describe('echo state machine (GT-201)', () => {
  it('runs present twice, produce, faster pass, done', () => {
    let state = startEcho();
    state = advanceEcho(state, { type: 'presented' });
    expect(state.stage).toBe('present-2');
    state = advanceEcho(state, { type: 'presented' });
    expect(state.stage).toBe('produce');
    state = advanceEcho(state, { type: 'produced', text: 'der Tisch' });
    expect(state.stage).toBe('fast-pass');
    expect(state.production).toBe('der Tisch');
    state = advanceEcho(state, { type: 'fast-pass-done' });
    expect(state.stage).toBe('done');
  });

  it('blocks advancing without production', () => {
    let state = startEcho();
    state = advanceEcho(state, { type: 'presented' });
    state = advanceEcho(state, { type: 'presented' });
    expect(() => advanceEcho(state, { type: 'fast-pass-done' })).toThrow(/Invalid echo transition/);
    expect(() => advanceEcho(state, { type: 'produced', text: '   ' })).toThrow(
      /Production must not be empty/,
    );
  });

  it('rejects skipping the second presentation', () => {
    const state = startEcho();
    expect(() => advanceEcho(state, { type: 'produced', text: 'der Tisch' })).toThrow(
      /Invalid echo transition/,
    );
  });
});
