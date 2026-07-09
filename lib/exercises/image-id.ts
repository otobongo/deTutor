import { ARTICLES, type Article, type VocabularyWord } from '@/lib/db/curriculum';
import type { GrammarErrorLogEntry } from '@/lib/db/learner';
import type { ReviewRating } from '@/lib/fsrs/scheduler';

// Image identification (GT-202 recognition, GT-203 production). Pure logic;
// the components render it and the caller writes log entries through the
// GT-214 single write path.

export interface RecognitionOption {
  readonly wordId: string;
  readonly label: string;
  // The article trap shows the target noun under a wrong article; choosing
  // it is gender confusion, not vocabulary failure.
  readonly kind: 'target' | 'distractor' | 'article-trap';
}

export interface RecognitionExercise {
  readonly targetWordId: string;
  readonly imageWord: string;
  readonly options: readonly RecognitionOption[];
}

function displayLabel(word: VocabularyWord): string {
  return word.article ? `${word.article} ${word.german}` : word.german;
}

function wrongArticleFor(article: Article): Article {
  const index = ARTICLES.indexOf(article);
  return ARTICLES[(index + 1) % ARTICLES.length] as Article;
}

// Deterministic distractor choice: same level, same theme where possible,
// nearest frequency ranks first. No RNG, no duplicates.
export function buildRecognitionExercise(
  target: VocabularyWord,
  corpus: readonly VocabularyWord[],
): RecognitionExercise {
  if (!target.picturable) {
    throw new Error(`"${target.german}" is not picturable; use the standard card instead.`);
  }
  const candidates = corpus
    .filter(
      (word) =>
        word.id !== target.id && word.cefrLevel === target.cefrLevel && word.wordType === 'noun',
    )
    .sort((a, b) => {
      const themeA = a.theme === target.theme ? 0 : 1;
      const themeB = b.theme === target.theme ? 0 : 1;
      return (
        themeA - themeB ||
        Math.abs(a.frequencyRank - target.frequencyRank) -
          Math.abs(b.frequencyRank - target.frequencyRank) ||
        a.id.localeCompare(b.id)
      );
    })
    .slice(0, 2);

  const options: RecognitionOption[] = [
    { wordId: target.id, label: displayLabel(target), kind: 'target' },
    ...candidates.map((word): RecognitionOption => ({
      wordId: word.id,
      label: displayLabel(word),
      kind: 'distractor',
    })),
  ];
  if (target.article) {
    options.push({
      wordId: `${target.id}#article-trap`,
      label: `${wrongArticleFor(target.article)} ${target.german}`,
      kind: 'article-trap',
    });
  }
  // Deterministic presentation order that still hides the answer position.
  options.sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return { targetWordId: target.id, imageWord: displayLabel(target), options };
}

export interface RecognitionResult {
  readonly correct: boolean;
  readonly correctLabel: string;
  readonly logEntry: GrammarErrorLogEntry | null;
}

export function gradeRecognition(
  exercise: RecognitionExercise,
  target: VocabularyWord,
  chosenWordId: string,
  nowIso: string,
): RecognitionResult {
  const chosen = exercise.options.find((option) => option.wordId === chosenWordId);
  if (!chosen) throw new Error(`Unknown option "${chosenWordId}".`);
  const correctLabel = displayLabel(target);
  if (chosen.kind === 'target') {
    return { correct: true, correctLabel, logEntry: null };
  }
  return {
    correct: false,
    correctLabel,
    logEntry:
      chosen.kind === 'article-trap'
        ? {
            category: 'gender',
            item: correctLabel,
            context: `Image recognition: chose "${chosen.label}" for ${correctLabel}`,
            at: nowIso,
          }
        : null,
  };
}

// GT-203: production phase. Word right but article wrong or missing scores
// partial and logs a gender error; the FSRS rating derives from the result.
export type ProductionVerdict = 'full' | 'partial' | 'wrong';

export interface ProductionResult {
  readonly verdict: ProductionVerdict;
  readonly rating: ReviewRating;
  readonly correctLabel: string;
  readonly logEntry: GrammarErrorLogEntry | null;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function gradeProduction(
  target: VocabularyWord,
  input: string,
  nowIso: string,
): ProductionResult {
  const correctLabel = displayLabel(target);
  const normalized = normalize(input);
  const wordMatches =
    normalized === normalize(target.german) || normalized.endsWith(` ${normalize(target.german)}`);

  if (!wordMatches) {
    return { verdict: 'wrong', rating: 'again', correctLabel, logEntry: null };
  }
  if (target.article === null || normalized === normalize(correctLabel)) {
    return { verdict: 'full', rating: 'good', correctLabel, logEntry: null };
  }
  return {
    verdict: 'partial',
    rating: 'hard',
    correctLabel,
    logEntry: {
      category: 'gender',
      item: correctLabel,
      context: `Image production: wrote "${input.trim()}" for ${correctLabel}`,
      at: nowIso,
    },
  };
}
