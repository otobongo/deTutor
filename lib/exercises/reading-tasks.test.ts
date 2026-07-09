import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DevFileStore } from '@/lib/db/store';
import { createGeminiClient, GeminiError, type GeminiTransport } from '@/lib/gemini/client';
import {
  checkAnswerKeyConsistency,
  generateReadingTask,
  scoreReadingTask,
  writeReadingScore,
  type ReadingTask,
} from './reading-tasks';

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

const matchingTask: ReadingTask = {
  format: 'matching',
  advertisements: [
    { id: 'a', text: 'Wohnung in Mitte, 2 Zimmer' },
    { id: 'b', text: 'Fahrrad zu verkaufen' },
    { id: 'c', text: 'Deutschkurs am Abend' },
  ],
  statements: [
    { statement: 'Lena sucht eine Wohnung.', matchesAdId: 'a' },
    { statement: 'Tom will Deutsch lernen.', matchesAdId: 'c' },
  ],
};

const mcTask: ReadingTask = {
  format: 'multiple-choice',
  text: 'Der Supermarkt ist wegen eines Feiertags geschlossen.',
  items: [
    {
      question: 'Warum ist der Supermarkt geschlossen?',
      options: ['Feiertag', 'Renovierung', 'Sonntag'],
      correctIndex: 0,
    },
    {
      question: 'Was ist geschlossen?',
      options: ['die Schule', 'der Supermarkt', 'das Kino'],
      correctIndex: 1,
    },
  ],
};

describe('reading task consistency (GT-208)', () => {
  it('accepts a consistent matching key', () => {
    expect(checkAnswerKeyConsistency(matchingTask)).toEqual([]);
  });

  it('rejects double-assigned and dangling matching keys', () => {
    const bad: ReadingTask = {
      ...matchingTask,
      statements: [
        { statement: 's1', matchesAdId: 'a' },
        { statement: 's2', matchesAdId: 'a' },
        { statement: 's3', matchesAdId: 'zzz' },
      ],
    };
    const problems = checkAnswerKeyConsistency(bad);
    expect(problems.some((problem) => problem.includes('two statements'))).toBe(true);
    expect(problems.some((problem) => problem.includes('unknown ad'))).toBe(true);
  });

  it('regenerates on inconsistency then fails typed', async () => {
    const inconsistent = JSON.stringify({
      ...matchingTask,
      statements: [
        { statement: 's1', matchesAdId: 'a' },
        { statement: 's2', matchesAdId: 'a' },
      ],
    });
    const client = clientWith([inconsistent, inconsistent]);
    const failure = await generateReadingTask(client, {
      format: 'matching',
      level: 'B1',
      text: 'Anzeigen',
      itemCount: 2,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GeminiError);
    expect((failure as GeminiError).message).toContain('consistency');
  });

  it('honors the configured item count in generation input', async () => {
    const client = clientWith([JSON.stringify(mcTask)]);
    const task = await generateReadingTask(client, {
      format: 'multiple-choice',
      level: 'A2',
      text: mcTask.format === 'multiple-choice' ? mcTask.text : '',
      itemCount: 2,
    });
    expect(task.format).toBe('multiple-choice');
    if (task.format === 'multiple-choice') expect(task.items).toHaveLength(2);
  });
});

describe('reading task scoring (GT-208)', () => {
  it('scores richtig/falsch and multiple choice deterministically', () => {
    const rf: ReadingTask = {
      format: 'richtig-falsch',
      text: 'Text',
      items: [
        { statement: 'wahr', answer: true },
        { statement: 'falsch', answer: false },
      ],
    };
    expect(scoreReadingTask(rf, { format: 'richtig-falsch', answers: [true, true] })).toEqual({
      correct: 1,
      total: 2,
      score: 50,
    });
    expect(scoreReadingTask(mcTask, { format: 'multiple-choice', answers: [0, 1] }).score).toBe(
      100,
    );
  });

  it('gives no credit to double-assigned matching answers', () => {
    const result = scoreReadingTask(matchingTask, { format: 'matching', answers: ['a', 'a'] });
    expect(result.correct).toBe(0);
    const clean = scoreReadingTask(matchingTask, { format: 'matching', answers: ['a', 'c'] });
    expect(clean.correct).toBe(2);
  });

  it('persists the score to SkillScore(reading) with appended attempts', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reading-score-'));
    const store = new DevFileStore(path.join(dir, 'store.json'));
    try {
      await writeReadingScore(store, 'a1-4', 50, '2026-07-09T08:00:00.000Z');
      const second = await writeReadingScore(store, 'a1-4', 80, '2026-07-10T08:00:00.000Z');
      expect(second.skill).toBe('reading');
      expect(second.score).toBe(80);
      expect(second.attempts).toHaveLength(2);
      expect(second.attempts[0]?.score).toBe(50);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
