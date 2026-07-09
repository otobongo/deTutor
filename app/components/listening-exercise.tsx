'use client';

import { useState } from 'react';
import type { AudioAsset } from '@/lib/media/provider';

// Listening exercise flow (GT-205): play the clip (captions whenever the
// asset requires them), replay whole or per segment, slower replay, then the
// learner describes what they understood and submits to evaluation (GT-206).

export interface ListeningClip {
  readonly full: AudioAsset;
  readonly segments: readonly AudioAsset[];
}

export function ListeningExercise({
  clip,
  onSubmit,
  submitting,
}: {
  clip: ListeningClip;
  onSubmit: (response: string) => void;
  submitting: boolean;
}) {
  const [response, setResponse] = useState('');
  const [playCount, setPlayCount] = useState(0);
  const [rate, setRate] = useState(1);

  function play(asset: AudioAsset, playbackRate: number): void {
    setPlayCount((count) => count + 1);
    if (asset.source.type === 'speech-synthesis' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(asset.source.text);
      utterance.lang = asset.source.lang;
      utterance.rate = playbackRate;
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="listening-exercise">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
          onClick={() => play(clip.full, rate)}
          data-testid={`listening-play-${clip.full.clipId}`}
        >
          {playCount === 0 ? 'Play' : 'Replay'}
        </button>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={rate < 1}
            onChange={(event) => setRate(event.target.checked ? 0.75 : 1)}
            data-testid="listening-slower"
          />
          Slower
        </label>
        {clip.segments.map((segment, index) => (
          <button
            key={segment.clipId}
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => play(segment, rate)}
            data-testid={`listening-segment-${segment.clipId}`}
          >
            Part {index + 1}
          </button>
        ))}
      </div>

      {clip.full.captionsRequired && playCount > 0 ? (
        <p className="text-sm italic opacity-80" data-testid="listening-captions">
          {clip.full.captionText}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (response.trim().length === 0 || submitting) return;
          onSubmit(response);
        }}
      >
        <label className="text-sm font-medium" htmlFor="listening-response">
          Describe what you understood (English or simple German):
        </label>
        <textarea
          id="listening-response"
          className="min-h-24 rounded border px-3 py-2"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          data-testid="listening-response"
        />
        <button
          type="submit"
          className="self-start rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
          disabled={response.trim().length === 0 || submitting}
          data-testid="listening-submit"
        >
          {submitting ? 'Evaluating...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
