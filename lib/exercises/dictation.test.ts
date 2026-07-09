import { describe, expect, it } from 'vitest';
import { diffDictation, gradeDictation } from './dictation';

const nowIso = '2026-07-09T08:00:00.000Z';
const expected = 'Wir fahren am Samstag nach Hamburg.';

describe('dictation (GT-211)', () => {
  it('scores an exact match (punctuation-insensitive) as full', () => {
    const result = gradeDictation(expected, 'Wir fahren am Samstag nach Hamburg', nowIso);
    expect(result.exact).toBe(true);
    expect(result.score).toBe(100);
    expect(result.logEntries).toEqual([]);
  });

  it('highlights an umlaut error at word level and logs it as spelling', () => {
    const result = gradeDictation('Das Wetter ist schön.', 'Das Wetter ist schon.', nowIso);
    const wrong = result.segments.find((segment) => segment.kind === 'wrong');
    expect(wrong).toEqual({ kind: 'wrong', expected: 'schön', submitted: 'schon' });
    expect(result.logEntries).toHaveLength(1);
    expect(result.logEntries[0]?.category).toBe('spelling');
    expect(result.logEntries[0]?.context).toContain('schon');
  });

  it('marks missing and extra words distinctly', () => {
    const segments = diffDictation('Wir fahren nach Hamburg', 'Wir fahren heute nach');
    expect(segments.map((segment) => segment.kind)).toEqual([
      'correct',
      'correct',
      'extra',
      'correct',
      'missing',
    ]);
  });

  it('partial credit is proportional to correct words', () => {
    const result = gradeDictation('Wir fahren nach Hamburg', 'Wir fahren nach Berlin', nowIso);
    expect(result.score).toBe(75);
    expect(result.exact).toBe(false);
  });
});
