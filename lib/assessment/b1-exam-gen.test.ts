import { describe, expect, it, vi } from 'vitest';
import { cumulativeCorpus } from '@/db/seed/seed-vocab';
import { GeminiError, type GeminiClient } from '@/lib/gemini/client';
import { B1_EXAM_BLUEPRINT, validateExamModule } from './b1-exam';
import { buildPlaceholderExamModule, generateExamModule } from './b1-exam-gen';

describe('B1 exam content generation', () => {
  const corpus = cumulativeCorpus('B1');

  it('the placeholder fills every module to the exact official blueprint', () => {
    for (const spec of B1_EXAM_BLUEPRINT) {
      const candidate = buildPlaceholderExamModule(spec.skill, corpus);
      expect(validateExamModule(candidate), spec.skill).toEqual([]);
    }
  });

  it('placeholder parts vary their items (no repeated faces across parts)', () => {
    const reading = buildPlaceholderExamModule('reading', corpus);
    const articleParts = reading.parts.filter((part) => part.part % 2 === 1);
    const firstStimuli = articleParts.map((part) => part.items[0]?.stimulus);
    expect(new Set(firstStimuli).size).toBe(articleParts.length);
  });

  it('placeholder production modules carry the three Goethe tasks with points', () => {
    for (const skill of ['writing', 'speaking'] as const) {
      const candidate = buildPlaceholderExamModule(skill, corpus);
      expect(candidate.productionTasks).toHaveLength(3);
      for (const task of candidate.productionTasks) {
        expect(task.contentPoints.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('generation retries once on blueprint violations, then fails as parse-failure', async () => {
    // Valid schema shape but the wrong part count for the blueprint.
    const bad = {
      skill: 'reading',
      parts: [
        {
          part: 1,
          items: [
            {
              stimulus: 'Text',
              question: 'F?',
              options: ['a', 'b', 'c'],
              correctIndex: 0,
              grammarItemId: 'genitiv',
            },
          ],
        },
      ],
      productionTasks: [],
    };
    const client = {
      chat: vi.fn(),
      generateJson: vi.fn().mockResolvedValue(bad),
    } as unknown as GeminiClient;
    await expect(generateExamModule(client, 'reading')).rejects.toBeInstanceOf(GeminiError);
    expect(client.generateJson).toHaveBeenCalledTimes(2);
  });

  it('a valid generated module returns on the first attempt', async () => {
    const valid = buildPlaceholderExamModule('writing', corpus);
    const client = {
      chat: vi.fn(),
      generateJson: vi.fn().mockResolvedValue(valid),
    } as unknown as GeminiClient;
    await expect(generateExamModule(client, 'writing')).resolves.toEqual(valid);
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });
});
