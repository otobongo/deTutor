import { describe, expect, it } from 'vitest';
import { gradeFor, groupProgress, scoreQuiz } from './progress';

describe('learn progress math', () => {
  it('grade bands: A 90+, B 75+, C 60+, D 40+, E below', () => {
    expect(gradeFor(100)).toBe('A');
    expect(gradeFor(90)).toBe('A');
    expect(gradeFor(89)).toBe('B');
    expect(gradeFor(75)).toBe('B');
    expect(gradeFor(60)).toBe('C');
    expect(gradeFor(40)).toBe('D');
    expect(gradeFor(39)).toBe('E');
    expect(gradeFor(0)).toBe('E');
  });

  it('group progress counts only ids in the group', () => {
    const progress = groupProgress(['a', 'b', 'c', 'd'], new Set(['a', 'b', 'x']));
    expect(progress).toEqual({ learned: 2, total: 4, percent: 50, grade: 'D' });
    expect(groupProgress([], new Set(['a']))).toEqual({
      learned: 0,
      total: 0,
      percent: 0,
      grade: 'E',
    });
  });

  it('quiz scoring is deterministic and rejects partial answers', () => {
    const quiz = [
      { question: 'q1', options: ['a', 'b'], correctIndex: 1 },
      { question: 'q2', options: ['a', 'b', 'c'], correctIndex: 0 },
    ];
    expect(scoreQuiz(quiz, [1, 0])).toEqual({ correct: 2, total: 2, score: 100, grade: 'A' });
    expect(scoreQuiz(quiz, [0, 0]).score).toBe(50);
    expect(() => scoreQuiz(quiz, [1])).toThrow('Answer every question');
  });
});
