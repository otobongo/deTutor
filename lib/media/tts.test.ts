import { describe, expect, it } from 'vitest';
import { audioCacheKey, narratorFor, voiceForProfile } from './tts';

describe('voice profile mapping and cache keys', () => {
  it('maps every settings voice profile to a Gemini voice, defaulting to Kore', () => {
    expect(voiceForProfile('warm-1')).toBe('Sulafat');
    expect(voiceForProfile('neutral-1')).toBe('Kore');
    expect(voiceForProfile('energetic-1')).toBe('Puck');
    expect(voiceForProfile('unknown-profile')).toBe('Kore');
  });

  it('the default narrator keeps the bare clip id so pre-generated clips stay valid', () => {
    expect(audioCacheKey('word-hund-noun', null)).toBe('word-hund-noun');
    expect(audioCacheKey('word-hund-noun', narratorFor('neutral-1'))).toBe('word-hund-noun');
  });

  it('non-default voices and multi-speaker mixes get voice-suffixed keys', () => {
    expect(audioCacheKey('word-hund-noun', narratorFor('warm-1'))).toBe('word-hund-noun@Sulafat');
    expect(
      audioCacheKey('dialogue-abc', [
        { name: 'Anna', voiceName: 'Kore' },
        { name: 'Ben', voiceName: 'Puck' },
      ]),
    ).toBe('dialogue-abc@Kore+Puck');
  });
});
