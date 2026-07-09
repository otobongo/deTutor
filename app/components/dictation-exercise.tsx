'use client';

import { useState } from 'react';
import type { AudioAsset } from '@/lib/media/provider';
import type { DictationResult } from '@/lib/exercises/dictation';

// Dictation flow (GT-211). Captions stay hidden during the attempt even for
// silent placeholder assets; after submission they appear so placeholder
// mode remains fully exercisable.

export function DictationExercise({
  audio,
  onSubmit,
  result,
}: {
  audio: AudioAsset;
  onSubmit: (submitted: string) => void;
  result: DictationResult | null;
}) {
  const [attempt, setAttempt] = useState('');

  function play(): void {
    if (audio.source.type === 'speech-synthesis' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(audio.source.text);
      utterance.lang = audio.source.lang;
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="dictation-exercise">
      <button
        type="button"
        className="self-start rounded-md bg-action px-3 py-1 text-sm text-action-inverse"
        onClick={play}
        data-testid={`dictation-play-${audio.clipId}`}
      >
        Play
      </button>

      {result === null ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (attempt.trim().length === 0) return;
            onSubmit(attempt);
          }}
        >
          <input
            className="w-full rounded-md border bg-surface px-3 py-2"
            value={attempt}
            onChange={(event) => setAttempt(event.target.value)}
            placeholder="Type exactly what you hear"
            aria-label="Dictation attempt"
            data-testid="dictation-input"
          />
          <button
            type="submit"
            className="rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
            disabled={attempt.trim().length === 0}
            data-testid="dictation-submit"
          >
            Check
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap gap-1" data-testid="dictation-diff">
            {result.segments.map((segment, index) => (
              <span
                key={index}
                data-diff={segment.kind}
                className={
                  segment.kind === 'correct'
                    ? 'text-success'
                    : 'rounded-sm bg-error-tint px-1 text-error line-through'
                }
              >
                {segment.kind === 'extra' ? segment.submitted : segment.expected}
              </span>
            ))}
          </p>
          {audio.captionsRequired ? (
            <p className="text-sm italic text-ink-muted" data-testid="dictation-captions">
              {audio.captionText}
            </p>
          ) : null}
          <p role="status">Score: {result.score} / 100</p>
        </div>
      )}
    </div>
  );
}
