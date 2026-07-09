'use client';

import { useCallback, useState } from 'react';
import type { AudioAsset } from '@/lib/media/provider';

// Client audio player for adapter-served assets (GT-007 caption contract):
// any asset with captionsRequired renders its captions. Placeholder speech
// synthesis degrades silently when the browser offers no de-DE voice; the
// captions carry the content either way.

export function AudioPlayer({ asset, label }: { asset: AudioAsset; label: string }) {
  const [played, setPlayed] = useState(false);

  const play = useCallback(() => {
    setPlayed(true);
    if (asset.source.type === 'speech-synthesis' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(asset.source.text);
      utterance.lang = asset.source.lang;
      window.speechSynthesis.speak(utterance);
    } else if (asset.source.type === 'url') {
      void new Audio(asset.source.url).play();
    }
  }, [asset]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={play}
        className="rounded border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        data-testid={`play-${asset.clipId}`}
      >
        {label}
      </button>
      {asset.captionsRequired && played ? (
        <p className="text-sm italic opacity-80" data-testid={`captions-${asset.clipId}`}>
          {asset.captionText}
        </p>
      ) : null}
    </div>
  );
}
