'use client';

import { useState } from 'react';
import type { ImageAsset } from '@/lib/media/provider';
import type { ProductionResult } from '@/lib/exercises/image-id';
import { Button } from './ui';

// Production-phase image identification (GT-203): image alone, the learner
// types (or dictates) the word WITH its article. Grading and FSRS rating
// happen in the caller via gradeProduction.

export function ImageProductionExercise({
  image,
  onSubmit,
  result,
}: {
  image: ImageAsset;
  onSubmit: (input: string) => void;
  result: ProductionResult | null;
}) {
  const [input, setInput] = useState('');

  return (
    <div className="flex flex-col gap-4" data-testid="image-production-exercise">
      {image.source.type === 'inline-svg' ? (
        <div
          className="max-w-xs"
          data-testid="image-production-image"
          role="img"
          aria-label="Picture of a vocabulary word to identify"
          // Own provider output from validated vocabulary data; not untrusted.
          dangerouslySetInnerHTML={{ __html: image.source.svg }}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image.source.url}
          alt="Picture of a vocabulary word to identify"
          className="max-w-xs"
          data-testid="image-production-image"
        />
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim().length === 0 || result !== null) return;
          onSubmit(input);
        }}
      >
        <input
          className="rounded-md border bg-surface px-3 py-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Name it, with the article"
          aria-label="The word with its article"
          disabled={result !== null}
          data-testid="image-production-input"
        />
        <Button
          type="submit"
          size="sm"
          disabled={input.trim().length === 0 || result !== null}
          data-testid="image-production-submit"
        >
          Submit
        </Button>
      </form>

      {result ? (
        <p data-testid="image-production-feedback" role="status">
          {result.verdict === 'full'
            ? 'Perfekt! Word and article both right.'
            : result.verdict === 'partial'
              ? `The word is right! The article makes it ${result.correctLabel}; that is the hard part, keep drilling it.`
              : `It is ${result.correctLabel}. You will see it again soon.`}
        </p>
      ) : null}
    </div>
  );
}
