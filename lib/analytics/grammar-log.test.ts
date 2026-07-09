import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DevFileStore } from '@/lib/db/store';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';
import {
  detectRecurringPatterns,
  errorsByCategory,
  errorsInWindow,
  loadGrammarErrors,
  writeGrammarError,
} from './grammar-log';

const now = new Date('2026-07-09T08:00:00.000Z');

function entry(
  category: GrammarErrorLogEntry['category'],
  item: string,
  daysAgo: number,
  context = 'Kannst du mich helfen?',
): GrammarErrorLogEntry {
  return {
    category,
    item,
    context,
    at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

describe('grammar log (GT-214)', () => {
  it('writes through the single validated path and reads back sorted', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'grammar-log-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await writeGrammarError(store, entry('case', 'mich/mir', 2));
      await writeGrammarError(store, entry('gender', 'die Woche', 1, 'der Woche war lang'));
      const entries = await loadGrammarErrors(store);
      expect(entries).toHaveLength(2);
      expect(entries[0]?.category).toBe('case');
      expect(entries.every((loaded) => loaded.context.length > 0)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an entry without context at the write path', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'grammar-log-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await expect(
        writeGrammarError(store, { ...entry('case', 'mich/mir', 0), context: '' }),
      ).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags three same-category same-item errors inside 14 days as recurring', () => {
    const entries = [
      entry('case', 'pronouns', 1, 'Kannst du mich helfen?'),
      entry('case', 'pronouns', 5, 'Ich danke dich.'),
      entry('case', 'pronouns', 13, 'Er hilft sie.'),
      entry('gender', 'die Woche', 2),
    ];
    const patterns = detectRecurringPatterns(entries, now);
    expect(patterns).toEqual([{ category: 'case', item: 'pronouns', occurrences: 3 }]);
  });

  it('does not flag errors that fall outside the window or below threshold', () => {
    const entries = [
      entry('case', 'pronouns', 1),
      entry('case', 'pronouns', 5, 'Ich danke dich.'),
      entry('case', 'pronouns', 20, 'Er hilft sie.'),
    ];
    expect(detectRecurringPatterns(entries, now)).toEqual([]);
  });

  it('filters by category and by time window', () => {
    const entries = [
      entry('case', 'pronouns', 1),
      entry('gender', 'die Woche', 2),
      entry('order', 'v2', 30),
    ];
    expect(errorsByCategory(entries, 'gender')).toHaveLength(1);
    const windowed = errorsInWindow(entries, new Date(now.getTime() - 10 * 86_400_000), now);
    expect(windowed).toHaveLength(2);
  });
});
