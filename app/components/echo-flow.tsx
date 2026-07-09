'use client';

import { useState } from 'react';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import { advanceEcho, startEcho, type EchoState } from '@/lib/lesson/echo';
import { AudioPlayer } from './audio-player';
import { VocabCard } from './vocab-card';

// Echo flow (GT-201): present twice (adapter audio), learner produces, then
// a faster second pass. The advance button is disabled until the machine
// allows the transition, so production is structurally mandatory.

export function EchoFlow({
  word,
  audio,
  onDone,
}: {
  word: VocabularyWord;
  audio: AudioAsset;
  onDone: (production: string) => void;
}) {
  const [state, setState] = useState<EchoState>(startEcho());
  const [production, setProduction] = useState('');

  function presented(): void {
    setState((current) => advanceEcho(current, { type: 'presented' }));
  }

  return (
    <div className="flex flex-col gap-4" data-testid={`echo-${word.id}`}>
      <VocabCard word={word} />

      {state.stage === 'present-1' || state.stage === 'present-2' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm opacity-80">
            Listen ({state.stage === 'present-1' ? 'first' : 'second'} time), then repeat it aloud.
          </p>
          <AudioPlayer asset={audio} label="Play" />
          <button
            type="button"
            className="self-start rounded bg-gray-900 px-3 py-1 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
            onClick={presented}
            data-testid="echo-heard"
          >
            I listened and repeated
          </button>
        </div>
      ) : null}

      {state.stage === 'produce' ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (production.trim().length === 0) return;
            setState((current) => advanceEcho(current, { type: 'produced', text: production }));
          }}
        >
          <input
            className="rounded border px-3 py-2"
            value={production}
            onChange={(event) => setProduction(event.target.value)}
            placeholder="Type (or say) it yourself"
            aria-label="Your production"
            data-testid="echo-production-input"
          />
          <button
            type="submit"
            className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-40"
            disabled={production.trim().length === 0}
            data-testid="echo-produce"
          >
            Submit
          </button>
        </form>
      ) : null}

      {state.stage === 'fast-pass' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm opacity-80">Faster second pass: listen and repeat once more.</p>
          <AudioPlayer asset={audio} label="Play (faster)" rate={1.3} />
          <button
            type="button"
            className="self-start rounded bg-gray-900 px-3 py-1 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
            onClick={() => {
              setState((current) => advanceEcho(current, { type: 'fast-pass-done' }));
              onDone(state.production ?? '');
            }}
            data-testid="echo-fast-pass-done"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
