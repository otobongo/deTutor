import type { GrammarErrorLogEntry } from '@/lib/db/learner';

// Dictation (GT-211): the learner types what they heard; feedback is a
// word-level diff. Misspelled words (umlauts included) log as "spelling".

export interface DiffSegment {
  readonly kind: 'correct' | 'wrong' | 'missing' | 'extra';
  readonly expected: string | null;
  readonly submitted: string | null;
}

function words(text: string): string[] {
  return text
    .replace(/[.,!?;:"„“]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

// Longest-common-subsequence alignment keeps the diff word-level: matched
// words are correct, paired mismatches are wrong, the rest are missing or
// extra.
export function diffDictation(expected: string, submitted: string): DiffSegment[] {
  const expectedWords = words(expected);
  const submittedWords = words(submitted);
  const lengths: number[][] = Array.from({ length: expectedWords.length + 1 }, () =>
    Array<number>(submittedWords.length + 1).fill(0),
  );
  for (let i = expectedWords.length - 1; i >= 0; i -= 1) {
    for (let j = submittedWords.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] =
        expectedWords[i]?.toLowerCase() === submittedWords[j]?.toLowerCase()
          ? (lengths[i + 1]![j + 1] ?? 0) + 1
          : Math.max(lengths[i + 1]![j] ?? 0, lengths[i]![j + 1] ?? 0);
    }
  }
  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < expectedWords.length && j < submittedWords.length) {
    const expectedWord = expectedWords[i] as string;
    const submittedWord = submittedWords[j] as string;
    if (expectedWord.toLowerCase() === submittedWord.toLowerCase()) {
      segments.push({ kind: 'correct', expected: expectedWord, submitted: submittedWord });
      i += 1;
      j += 1;
    } else if ((lengths[i + 1]![j] ?? 0) >= (lengths[i]![j + 1] ?? 0)) {
      // Pair the dropped expected word with the submitted one when neither
      // survives into the LCS; that reads as a substitution (wrong spelling).
      if ((lengths[i + 1]![j + 1] ?? 0) === (lengths[i + 1]![j] ?? 0)) {
        segments.push({ kind: 'wrong', expected: expectedWord, submitted: submittedWord });
        i += 1;
        j += 1;
      } else {
        segments.push({ kind: 'missing', expected: expectedWord, submitted: null });
        i += 1;
      }
    } else {
      segments.push({ kind: 'extra', expected: null, submitted: submittedWord });
      j += 1;
    }
  }
  while (i < expectedWords.length) {
    segments.push({ kind: 'missing', expected: expectedWords[i] as string, submitted: null });
    i += 1;
  }
  while (j < submittedWords.length) {
    segments.push({ kind: 'extra', expected: null, submitted: submittedWords[j] as string });
    j += 1;
  }
  return segments;
}

export interface DictationResult {
  readonly score: number;
  readonly exact: boolean;
  readonly segments: readonly DiffSegment[];
  readonly logEntries: readonly GrammarErrorLogEntry[];
}

export function gradeDictation(
  expected: string,
  submitted: string,
  nowIso: string,
): DictationResult {
  const segments = diffDictation(expected, submitted);
  const total = segments.filter((segment) => segment.kind !== 'extra').length;
  const correct = segments.filter((segment) => segment.kind === 'correct').length;
  const logEntries = segments
    .filter((segment) => segment.kind === 'wrong')
    .map((segment): GrammarErrorLogEntry => ({
      category: 'spelling',
      item: segment.expected ?? '',
      context: `Dictation: wrote "${segment.submitted ?? ''}" for "${segment.expected ?? ''}"`,
      at: nowIso,
    }));
  return {
    score: total === 0 ? 0 : Math.round((100 * correct) / total),
    exact: segments.every((segment) => segment.kind === 'correct'),
    segments,
    logEntries,
  };
}
