// Learn progress math (owner-directed 2026-07-10): percentages and grade
// bands for word groups and foundation topics, and deterministic quiz
// scoring for the foundation self-checks. Pure functions, no I/O.

export const GRADE_BANDS = [
  { grade: 'A', min: 90 },
  { grade: 'B', min: 75 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 40 },
  { grade: 'E', min: 0 },
] as const;

export type Grade = (typeof GRADE_BANDS)[number]['grade'];

export function gradeFor(percent: number): Grade {
  const bounded = Math.max(0, Math.min(100, percent));
  const band = GRADE_BANDS.find((candidate) => bounded >= candidate.min);
  return (band ?? GRADE_BANDS[GRADE_BANDS.length - 1]!).grade;
}

export interface GroupProgress {
  readonly learned: number;
  readonly total: number;
  readonly percent: number;
  readonly grade: Grade;
}

export function groupProgress(
  wordIds: readonly string[],
  learnedIds: ReadonlySet<string>,
): GroupProgress {
  const learned = wordIds.filter((id) => learnedIds.has(id)).length;
  const total = wordIds.length;
  const percent = total === 0 ? 0 : Math.round((100 * learned) / total);
  return { learned, total, percent, grade: gradeFor(percent) };
}

export interface QuizQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
}

export interface QuizResult {
  readonly correct: number;
  readonly total: number;
  readonly score: number;
  readonly grade: Grade;
}

export function scoreQuiz(
  questions: readonly QuizQuestion[],
  answers: readonly number[],
): QuizResult {
  if (answers.length !== questions.length) {
    throw new Error('Answer every question before scoring.');
  }
  const correct = questions.filter(
    (question, index) => answers[index] === question.correctIndex,
  ).length;
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((100 * correct) / total);
  return { correct, total, score, grade: gradeFor(score) };
}
