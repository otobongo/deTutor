'use client';

import { useState } from 'react';
import type { WarmupDisplayItem } from '@/app/actions/lesson';
import { REVIEW_RATINGS, type ReviewRating } from '@/lib/fsrs/scheduler';
import { Button } from './ui';

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
  items,
  onRate,
  onDone,
}: {
  items: readonly WarmupDisplayItem[];
  // The caller routes by item kind (review -> FSRS, retest -> retention);
  // this component treats every card identically, keeping the disguise.
  onRate: (item: WarmupDisplayItem, rating: ReviewRating) => Promise<void>;
  onDone: (ratings: readonly ReviewRating[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<readonly ReviewRating[]>([]);
  const [saving, setSaving] = useState(false);

  const item = items[index];
  const word = item?.word;
  if (!item || !word) return null;

  async function rate(rating: ReviewRating): Promise<void> {
    if (!item || saving) return;
    setSaving(true);
    await onRate(item, rating);
    const nextRatings = [...ratings, rating];
    setSaving(false);
    if (index + 1 >= items.length) {
      onDone(nextRatings);
      return;
    }
    setRatings(nextRatings);
    setIndex(index + 1);
    setRevealed(false);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="warmup-review">
      <p className="text-sm text-ink-muted" aria-live="polite" data-testid="warmup-progress">
        Card {index + 1} of {items.length}
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
          <Button variant="secondary" onClick={() => setRevealed(true)} data-testid="warmup-reveal">
            Show answer
          </Button>
        )}
      </div>
      {revealed ? (
        <div className="flex gap-2" role="group" aria-label="How well did you recall this word?">
          {REVIEW_RATINGS.map((rating) => (
            <Button
              key={rating}
              variant="secondary"
              disabled={saving}
              onClick={() => void rate(rating)}
              data-testid={`warmup-rate-${rating}`}
            >
              {RATING_LABELS[rating]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
