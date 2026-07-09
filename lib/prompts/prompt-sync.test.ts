import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TUTOR_SYSTEM_PROMPT } from './tutor-system-prompt';

// The CI sync check (GT-109): the embedded prompt must match the doc byte for
// byte. If you edited one, regenerate or update the other in the same commit.

describe('system prompt sync (GT-109)', () => {
  it('matches docs/german-tutor-system-prompt-v2.md verbatim', () => {
    const doc = readFileSync(
      path.resolve(__dirname, '../../docs/german-tutor-system-prompt-v2.md'),
      'utf8',
    );
    expect(TUTOR_SYSTEM_PROMPT).toBe(doc);
  });

  it('carries the non-negotiable anchors of the tutor identity', () => {
    for (const anchor of [
      'Echo teaching',
      'Noun and article are one package',
      'der is blue, die is red, das is green',
      'Never inflate a score to encourage',
    ]) {
      expect(TUTOR_SYSTEM_PROMPT).toContain(anchor);
    }
  });
});
