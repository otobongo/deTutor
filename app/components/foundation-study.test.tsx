// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FoundationTopic } from '@/db/seed/foundations';
import { FoundationStudy } from './foundation-study';

const topic: FoundationTopic = {
  id: 'numbers',
  title: 'Numbers',
  blurb: 'Count to hundert.',
  grammarItemIds: ['teen-numbers-pattern'],
  sections: [
    {
      heading: 'Teens',
      body: 'Glue the small number onto zehn: dreizehn, vierzehn, and so on for the teens.',
      examples: [{ de: 'Sie ist dreizehn.', en: 'She is thirteen.' }],
    },
  ],
  quiz: [
    { question: '21?', options: ['einundzwanzig', 'zwanzigeins'], correctIndex: 0 },
    { question: '16?', options: ['sechszehn', 'sechzehn'], correctIndex: 1 },
    { question: '13?', options: ['dreizehn', 'dreißig'], correctIndex: 0 },
  ],
};

afterEach(cleanup);

describe('foundation study', () => {
  it('scores the self-check, shows the grade, and allows a retake', async () => {
    const submitQuiz = vi.fn().mockResolvedValue({
      correct: 2,
      total: 3,
      score: 67,
      grade: 'C',
      bestScore: 67,
    });
    render(
      <FoundationStudy
        topic={topic}
        exampleAudio={{}}
        initialMarked={false}
        initialBestScore={null}
        submitQuiz={submitQuiz}
        markLearned={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('quiz-0-0'));
    fireEvent.click(screen.getByTestId('quiz-1-0'));
    fireEvent.click(screen.getByTestId('quiz-2-0'));
    fireEvent.click(screen.getByTestId('quiz-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('quiz-result').textContent).toContain('67 / 100, grade C'),
    );
    expect(submitQuiz).toHaveBeenCalledWith('numbers', [0, 0, 0]);
    fireEvent.click(screen.getByTestId('quiz-retake'));
    expect(screen.queryByTestId('quiz-result')).toBeNull();
  });

  it('marking learned is a toggle that persists through the callback', async () => {
    const markLearned = vi.fn().mockResolvedValue(undefined);
    render(
      <FoundationStudy
        topic={topic}
        exampleAudio={{}}
        initialMarked={false}
        initialBestScore={100}
        submitQuiz={vi.fn()}
        markLearned={markLearned}
      />,
    );
    expect(screen.getByTestId('foundation-best').textContent).toContain('100');
    fireEvent.click(screen.getByTestId('foundation-mark'));
    await waitFor(() =>
      expect(screen.getByTestId('foundation-mark').textContent).toContain('Learned ✓'),
    );
    expect(markLearned).toHaveBeenCalledWith('numbers', true);
  });
});
