'use client';

import { useState } from 'react';
import type { VocabularyWord } from '@/lib/db/curriculum';
import { REVIEW_RATINGS, type ReviewRating } from '@/lib/fsrs/scheduler';

// Interactive warm-up (GT-105 UI contract): one card at a time, answer
// hidden until the learner commits, then the four FSRS ratings. Ratings are
// reported per card (persistence) and once more in bulk on completion
// (session report). Prop-driven so tests inject fakes for the actions.

const RATING_LABELS: Readonly<Record<ReviewRating, string>> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

export function WarmupReview({
  words,
  onRate,
  onDone,
}: {
  words: readonly VocabularyWord[];
  onRate: (wordId: string, rating: ReviewRating) => Promise<void>;
  onDone: (ratings: readonly ReviewRating[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<readonly ReviewRating[]>([]);
  const [saving, setSaving] = useState(false);

  const word = words[index];
  if (!word) return null;

  async function rate(rating: ReviewRating): Promise<void> {
    if (!word || saving) return;
    setSaving(true);
    await onRate(word.id, rating);
    const nextRatings = [...ratings, rating];
    setSaving(false);
    if (index + 1 >= words.length) {
      onDone(nextRatings);
      return;
    }
    setRatings(nextRatings);
    setIndex(index + 1);
    setRevealed(false);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="warmup-review">
      <p className="text-sm text-ink-muted" data-testid="warmup-progress">
        Card {index + 1} of {words.length}
      </p>
      <div className="flex flex-col gap-2 rounded-lg border bg-surface p-4">
        <p className="text-2xl font-medium" lang="de" data-testid="warmup-front">
          {word.article ? (
            <span style={{ color: `var(--article-${word.article})` }}>{word.article} </span>
          ) : null}
          {word.german}
        </p>
        {revealed ? (
          <div className="flex flex-col gap-1" data-testid="warmup-back">
            <p>{word.translation}</p>
            {word.exampleDe ? (
              <p className="rounded-md bg-reading-surface p-2 text-sm" lang="de">
                {word.exampleDe}
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="self-start rounded-md border border-border-default bg-surface px-3 py-1"
            onClick={() => setRevealed(true)}
            data-testid="warmup-reveal"
          >
            Show answer
          </button>
        )}
      </div>
      {revealed ? (
        <div className="flex gap-2" role="group" aria-label="How well did you recall this word?">
          {REVIEW_RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              className="rounded-md border border-border-default bg-surface px-3 py-2 hover:bg-surface-2 disabled:opacity-40"
              disabled={saving}
              onClick={() => void rate(rating)}
              data-testid={`warmup-rate-${rating}`}
            >
              {RATING_LABELS[rating]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
