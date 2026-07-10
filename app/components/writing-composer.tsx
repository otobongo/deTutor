'use client';

import { useMemo, useState } from 'react';
import { checkContentPoints, wordCount, type WritingPrompt } from '@/lib/exercises/composers';
import { Button } from './ui';

// Writing composer (GT-212): visible content-point checklist, live word
// count, and a soft warning (never a block) when points look uncovered.
// Submission goes to the GT-213 correction engine.

export function WritingComposer({
  prompt,
  onSubmit,
  submitting,
}: {
  prompt: WritingPrompt;
  onSubmit: (text: string) => void;
  submitting: boolean;
}) {
  const [text, setText] = useState('');
  const [warned, setWarned] = useState(false);

  const coverage = useMemo(() => checkContentPoints(text, prompt.contentPoints), [text, prompt]);
  const count = wordCount(text);
  const uncovered = coverage.filter((result) => !result.covered);

  function submit(): void {
    if (text.trim().length === 0 || submitting) return;
    if (uncovered.length > 0 && !warned) {
      setWarned(true);
      return;
    }
    onSubmit(text);
  }

  return (
    <div className="flex flex-col gap-4" data-testid={`composer-${prompt.id}`}>
      <p className="font-medium">{prompt.prompt}</p>

      <ul className="flex flex-col gap-1 text-sm" data-testid="content-checklist">
        {coverage.map((result) => (
          <li
            key={result.point.description}
            data-covered={result.covered}
            role="checkbox"
            aria-checked={result.covered}
          >
            <span aria-hidden>{result.covered ? '[covered] ' : '[not covered] '}</span>
            {result.point.description}
          </li>
        ))}
      </ul>

      <textarea
        className="min-h-40 rounded-md border bg-surface px-3 py-2"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setWarned(false);
        }}
        aria-label="Your text"
        data-testid="composer-text"
      />
      <p className="text-sm text-ink-muted" data-testid="composer-word-count">
        {count} / ~{prompt.targetWords} words
      </p>

      {warned && uncovered.length > 0 ? (
        <p role="alert" data-testid="composer-soft-warning">
          It looks like you have not covered: {uncovered.map((r) => r.point.description).join('; ')}
          . Submit anyway or keep writing.
        </p>
      ) : null}

      <Button
        disabled={text.trim().length === 0 || submitting}
        onClick={submit}
        data-testid="composer-submit"
      >
        {submitting ? 'Correcting...' : warned && uncovered.length > 0 ? 'Submit anyway' : 'Submit'}
      </Button>
    </div>
  );
}
