import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

describe('repository conventions (GT-001)', () => {
  it('CLAUDE.md contains the adapter law verbatim', () => {
    const claudeMd = readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain(
      'All image, audio, and voice access goes through `lib/media`. If you',
    );
    expect(claudeMd).toContain('you are about to break');
    expect(claudeMd).toContain("the build's most important seam");
  });

  it('CLAUDE.md references all four source documents', () => {
    const claudeMd = readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    for (const doc of [
      'docs/german-tutor-engineering-strategy.md',
      'docs/german-tutor-prd-claude-code-v2.md',
      'docs/german-tutor-implementation-plan.md',
      'docs/german-tutor-system-prompt-v2.md',
    ]) {
      expect(claudeMd).toContain(doc);
    }
  });

  it('the CI gate script chains every check', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const step of ['lint', 'format:check', 'typecheck', 'test', 'test:e2e']) {
      expect(pkg.scripts.ci).toContain(step);
    }
  });
});
