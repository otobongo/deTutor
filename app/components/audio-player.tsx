'use client';

import { useCallback, useState } from 'react';
import type { AudioAsset } from '@/lib/media/provider';

// Client audio player for adapter-served assets (GT-007 caption contract):
// any asset with captionsRequired renders its captions. Placeholder speech
// synthesis degrades silently when the browser offers no de-DE voice; the
// captions carry the content either way. Two variants (owner-directed
// 2026-07-10): the compact speaker icon is the default listening affordance
// next to content; the labeled button remains for controls whose text
// carries meaning (play slower, faster second pass).

function SpeakerIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
    </svg>
  );
}

export function AudioPlayer({
  asset,
  label,
  rate = 1,
  variant = 'button',
}: {
  asset: AudioAsset;
  label: string;
  rate?: number;
  variant?: 'button' | 'icon';
}) {
  const [played, setPlayed] = useState(false);

  const play = useCallback(() => {
    setPlayed(true);
    if (asset.source.type === 'speech-synthesis' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(asset.source.text);
      utterance.lang = asset.source.lang;
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    } else if (asset.source.type === 'url') {
      void new Audio(asset.source.url).play();
    }
  }, [asset, rate]);

  return (
    <div className={variant === 'icon' ? 'flex flex-col gap-1' : 'flex flex-col gap-2'}>
      <button
        type="button"
        onClick={play}
        aria-label={label}
        title={label}
        className={
          variant === 'icon'
            ? 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-start rounded-pill border border-border-default bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink'
            : 'inline-flex min-h-11 items-center self-start rounded-md border bg-surface px-3 py-1 text-sm hover:bg-surface-2'
        }
        data-testid={`play-${asset.clipId}`}
      >
        {variant === 'icon' ? <SpeakerIcon /> : label}
      </button>
      {asset.captionsRequired && played ? (
        <p
          className="text-sm italic text-ink-muted"
          role="status"
          lang={asset.source.type === 'speech-synthesis' ? asset.source.lang : undefined}
          data-testid={`captions-${asset.clipId}`}
        >
          {asset.captionText}
        </p>
      ) : null}
    </div>
  );
}
