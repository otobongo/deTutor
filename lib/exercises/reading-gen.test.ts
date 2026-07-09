import { describe, expect, it } from 'vitest';
import { cumulativeCorpus, loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { createGeminiClient, GeminiError, type GeminiTransport } from '@/lib/gemini/client';
import {
  generateReadingText,
  LENGTH_CAP_WORDS,
  tokenizeGerman,
  validateReadingEnvelope,
} from './reading-gen';

const a1Corpus = loadVocabSeedFile('A1');

function clientWith(responses: string[]) {
  let calls = 0;
  const transport: GeminiTransport = {
    generate: () => {
      calls += 1;
      const next = responses.shift();
      if (next === undefined) throw new Error('transport exhausted');
      return Promise.resolve(next);
    },
  };
  return {
    client: createGeminiClient(transport, { fast: 'f', deep: 'd' }, () => {}),
    calls: () => calls,
  };
}

const compliantA1 = JSON.stringify({
  format: 'note',
  title: 'Notiz',
  text: 'Hallo! Ich bin heute nicht zu Hause. Der Schlüssel ist unter der Matte. Bis morgen!',
});

describe('reading envelope validation (GT-207)', () => {
  it('accepts a compliant A1 note', () => {
    const violations = validateReadingEnvelope(
      { format: 'note', text: 'Hallo! Ich bin heute nicht zu Hause. Bis morgen!' },
      'A1',
      a1Corpus,
    );
    expect(violations).toEqual([]);
  });

  it('rejects an over-cap A1 text', () => {
    const longText = Array(LENGTH_CAP_WORDS.A1 + 10)
      .fill('heute')
      .join(' ');
    const violations = validateReadingEnvelope({ format: 'sign', text: longText }, 'A1', a1Corpus);
    expect(violations.some((violation) => violation.rule === 'length')).toBe(true);
  });

  it('rejects a format outside the level', () => {
    const violations = validateReadingEnvelope(
      { format: 'press-report', text: 'Hallo!' },
      'A1',
      a1Corpus,
    );
    expect(violations.some((violation) => violation.rule === 'format')).toBe(true);
  });

  it('rejects text blowing the stretch budget', () => {
    const jargon =
      'Quantenverschränkung Epistemologie Verfassungsgerichtsbarkeit Photosynthese ' +
      'Thermodynamik Relativitätstheorie Bundesverfassungsgericht Molekularbiologie';
    const violations = validateReadingEnvelope({ format: 'note', text: jargon }, 'A1', a1Corpus);
    expect(violations.some((violation) => violation.rule === 'stretch-budget')).toBe(true);
  });

  it('tokenizes German with umlauts and eszett intact', () => {
    expect(tokenizeGerman('Der große Fuß! Süß, oder?')).toEqual([
      'der',
      'große',
      'fuß',
      'süß',
      'oder',
    ]);
  });
});

describe('reading generation (GT-207)', () => {
  it('returns a validated A1 note under the cap', async () => {
    const { client } = clientWith([compliantA1]);
    const text = await generateReadingText(client, {
      level: 'A1',
      theme: 'home-living',
      corpus: a1Corpus,
    });
    expect(['sign', 'note']).toContain(text.format);
    expect(tokenizeGerman(text.text).length).toBeLessThanOrEqual(LENGTH_CAP_WORDS.A1);
  });

  it('produces one of the three B1 formats', async () => {
    // Corpus-derived text: envelope-compliant by construction.
    const corpusText = cumulativeCorpus('B1')
      .slice(0, 20)
      .map((word) => word.german)
      .join(' ');
    const b1 = JSON.stringify({
      format: 'press-report',
      title: 'Bericht',
      text: `Heute ist viel passiert. ${corpusText}.`,
    });
    const { client } = clientWith([b1]);
    const text = await generateReadingText(client, {
      level: 'B1',
      theme: 'media-communication',
      corpus: cumulativeCorpus('B1'),
    });
    expect(['blog-post', 'press-report', 'advertisements']).toContain(text.format);
  });

  it('regenerates once on an envelope violation, then fails typed', async () => {
    const badFormat = JSON.stringify({ format: 'press-report', title: 'x', text: 'Hallo!' });
    const { client, calls } = clientWith([badFormat, badFormat]);
    const failure = await generateReadingText(client, {
      level: 'A1',
      theme: 'general',
      corpus: a1Corpus,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).message).toContain('envelope');
    expect(calls()).toBe(2);
  });

  it('recovers when the regeneration is compliant', async () => {
    const badFormat = JSON.stringify({ format: 'press-report', title: 'x', text: 'Hallo!' });
    const { client } = clientWith([badFormat, compliantA1]);
    const text = await generateReadingText(client, {
      level: 'A1',
      theme: 'general',
      corpus: a1Corpus,
    });
    expect(text.format).toBe('note');
  });
});
