'use client';

import { useEffect, useState } from 'react';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { WordExtrasPayload } from '@/app/actions/vocab';
import { AudioPlayer } from './audio-player';
import { EchoFlow } from './echo-flow';

// The word workspace (owner-directed 2026-07-10): a focus word presented the
// way Google Translate presents a translation. Three zones: the focus word
// big and confident, its context (example plus a plain-English note, both
// audible), and its neighborhood of related corpus words, each one tap from
// joining the review deck. Extras load after first paint so the echo flow
// never waits on the brain.

export function WordWorkspace({
  word,
  audio,
  loadExtras,
  addToDeck,
  onEchoDone,
}: {
  word: VocabularyWord;
  audio: AudioAsset;
  loadExtras: (wordId: string) => Promise<WordExtrasPayload | null>;
  addToDeck: (wordIds: readonly string[]) => Promise<number>;
  onEchoDone: (production: string) => void;
}) {
  const [extras, setExtras] = useState<WordExtrasPayload | null>(null);
  const [openRelated, setOpenRelated] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());

  // The runner keys this component by word id, so a new word is a fresh
  // mount; the effect only loads, never resets.
  useEffect(() => {
    let cancelled = false;
    void loadExtras(word.id)
      .then((payload) => {
        if (!cancelled) setExtras(payload);
      })
      .catch(() => {
        // No extras this time; the focus word and echo still work.
      });
    return () => {
      cancelled = true;
    };
  }, [word.id, loadExtras]);

  async function tapRelated(relatedWordId: string): Promise<void> {
    setOpenRelated((current) => (current === relatedWordId ? null : relatedWordId));
    if (!addedIds.has(relatedWordId)) {
      await addToDeck([relatedWordId]);
      setAddedIds((current) => new Set([...current, relatedWordId]));
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid={`word-workspace-${word.id}`}>
      {/* Focus zone: one word, one glance. */}
      <div className="flex flex-col gap-2 rounded-lg border bg-surface p-5">
        <p className="font-display text-4xl font-semibold tracking-tight" lang="de">
          {word.article ? (
            <span style={{ color: `var(--article-${word.article})` }} data-testid="focus-article">
              {word.article}{' '}
            </span>
          ) : null}
          <span data-testid="focus-german">{word.german}</span>
        </p>
        <p className="text-lg text-ink-muted" data-testid="focus-translation">
          {word.translation}
        </p>
        <div className="flex items-center gap-3">
          {word.ipa ? (
            <span className="font-mono text-sm text-ink-subtle">/{word.ipa}/</span>
          ) : null}
          <AudioPlayer asset={audio} label="Hear it" />
        </div>
      </div>

      {/* Echo strip: the production ritual, directly under the focus word.
          Extras append BELOW so their async arrival never shifts it. */}
      <EchoFlow key={word.id} word={word} audio={audio} onDone={onEchoDone} showCard={false} />

      {/* Context zone: the word in use, and why it works that way. */}
      {extras && extras.senses.length > 1 ? (
        <p className="text-sm text-ink-muted" data-testid="focus-senses">
          Also means: {extras.senses.join(' · ')}
        </p>
      ) : null}
      {extras?.example ? (
        <div
          className="flex flex-col gap-2 rounded-lg bg-reading-surface p-4 font-reading text-reading-ink"
          data-testid="context-example"
        >
          <p lang="de">{extras.example.text}</p>
          {word.exampleEn ? <p className="text-sm text-ink-muted">{word.exampleEn}</p> : null}
          <AudioPlayer asset={extras.example.audio} label="Hear the sentence" />
        </div>
      ) : null}
      {extras?.note ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface p-4"
          data-testid="context-note"
        >
          <p className="text-sm">{extras.note.text}</p>
          <AudioPlayer asset={extras.note.audio} label="Hear the explanation" />
        </div>
      ) : null}

      {/* Neighborhood zone: related corpus words, one tap from the deck. */}
      {extras && extras.related.length > 0 ? (
        <div className="flex flex-col gap-2" data-testid="word-neighborhood">
          <p className="text-sm font-medium text-ink-muted">Words nearby</p>
          <div className="flex flex-wrap gap-2">
            {extras.related.map(({ word: neighbor, relation }) => (
              <button
                key={neighbor.id}
                type="button"
                className={`rounded-pill border px-3 py-1 text-sm ${
                  openRelated === neighbor.id
                    ? 'border-border-strong bg-surface-2'
                    : 'border-border-default bg-surface hover:bg-surface-2'
                }`}
                onClick={() => void tapRelated(neighbor.id)}
                data-testid={`related-${neighbor.id}`}
                data-relation={relation}
              >
                {neighbor.article ? (
                  <span style={{ color: `var(--article-${neighbor.article})` }}>
                    {neighbor.article}{' '}
                  </span>
                ) : null}
                <span lang="de">{neighbor.german}</span>
              </button>
            ))}
          </div>
          {openRelated
            ? extras.related
                .filter(({ word: neighbor }) => neighbor.id === openRelated)
                .map(({ word: neighbor }) => (
                  <p
                    key={neighbor.id}
                    className="rounded-md border border-border-default bg-surface p-2 text-sm"
                    role="status"
                    data-testid="related-detail"
                  >
                    {neighbor.article ? `${neighbor.article} ` : ''}
                    {neighbor.german}: {neighbor.translation}
                    {neighbor.exampleDe ? (
                      <span className="block text-ink-muted" lang="de">
                        {neighbor.exampleDe}
                      </span>
                    ) : null}
                    <span className="block text-xs text-ink-subtle">
                      {addedIds.has(neighbor.id)
                        ? 'Added to your review deck.'
                        : 'Adding to your review deck…'}
                    </span>
                  </p>
                ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
