'use client';

import { useEffect, useState } from 'react';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { WordExtrasPayload } from '@/app/actions/vocab';
import { AudioPlayer } from './audio-player';
import { EchoFlow } from './echo-flow';

// The word workspace (owner-directed 2026-07-10): a focus word presented the
// way Google Translate presents a translation. Desktop uses a deliberate
// two-column layout (focus and production left, context and neighborhood
// right); mobile stacks purposefully. Extras load after first paint so
// production never waits on the brain. In the daily session the echo strip
// is mandatory; the Learn flow studies without it (recitation is the
// learner's own ritual there). Neighbor chips open with their own play
// button when an audio loader is provided.

export function WordWorkspace({
  word,
  audio,
  loadExtras,
  addToDeck,
  onEchoDone,
  echo = true,
  loadNeighborAudio,
}: {
  word: VocabularyWord;
  audio: AudioAsset;
  loadExtras: (wordId: string) => Promise<WordExtrasPayload | null>;
  addToDeck: (wordIds: readonly string[]) => Promise<number>;
  onEchoDone?: (production: string) => void;
  echo?: boolean;
  loadNeighborAudio?: (wordId: string) => Promise<AudioAsset | null>;
}) {
  const [extras, setExtras] = useState<WordExtrasPayload | null>(null);
  const [openRelated, setOpenRelated] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [neighborAudio, setNeighborAudio] = useState<Record<string, AudioAsset>>({});

  // The caller keys this component by word id, so a new word is a fresh
  // mount; the effect only loads, never resets.
  useEffect(() => {
    let cancelled = false;
    void loadExtras(word.id)
      .then((payload) => {
        if (!cancelled) setExtras(payload);
      })
      .catch(() => {
        // No extras this time; the focus word still works.
      });
    return () => {
      cancelled = true;
    };
  }, [word.id, loadExtras]);

  async function tapRelated(relatedWordId: string): Promise<void> {
    setOpenRelated((current) => (current === relatedWordId ? null : relatedWordId));
    if (loadNeighborAudio && !neighborAudio[relatedWordId]) {
      void loadNeighborAudio(relatedWordId).then((asset) => {
        if (asset) setNeighborAudio((current) => ({ ...current, [relatedWordId]: asset }));
      });
    }
    if (!addedIds.has(relatedWordId)) {
      await addToDeck([relatedWordId]);
      setAddedIds((current) => new Set([...current, relatedWordId]));
    }
  }

  return (
    <div
      className="flex flex-col gap-5 md:grid md:grid-cols-[3fr_2fr] md:items-start md:gap-6"
      data-testid={`word-workspace-${word.id}`}
    >
      {/* Left column: the focus word and the production ritual. */}
      <div className="flex flex-col gap-5">
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
            <AudioPlayer asset={audio} label="Hear it" variant="icon" />
          </div>
        </div>

        {echo ? (
          <EchoFlow
            key={word.id}
            word={word}
            audio={audio}
            onDone={onEchoDone ?? (() => {})}
            showCard={false}
          />
        ) : null}
      </div>

      {/* Right column: context and neighborhood, appended as extras arrive
          so their async load never shifts the production controls. */}
      <div className="flex flex-col gap-4">
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
            <AudioPlayer asset={extras.example.audio} label="Hear the sentence" variant="icon" />
          </div>
        ) : null}
        {extras?.note ? (
          <div
            className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface p-4"
            data-testid="context-note"
          >
            <p className="text-sm">{extras.note.text}</p>
            <AudioPlayer asset={extras.note.audio} label="Hear the explanation" variant="icon" />
          </div>
        ) : null}

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
                    <div
                      key={neighbor.id}
                      className="flex flex-col gap-1 rounded-md border border-border-default bg-surface p-2 text-sm"
                      role="status"
                      data-testid="related-detail"
                    >
                      <p>
                        {neighbor.article ? `${neighbor.article} ` : ''}
                        {neighbor.german}: {neighbor.translation}
                      </p>
                      {neighbor.exampleDe ? (
                        <p className="text-ink-muted" lang="de">
                          {neighbor.exampleDe}
                        </p>
                      ) : null}
                      {neighborAudio[neighbor.id] ? (
                        <AudioPlayer
                          asset={neighborAudio[neighbor.id]!}
                          label="Hear it"
                          variant="icon"
                        />
                      ) : null}
                      <p className="text-xs text-ink-subtle">
                        {addedIds.has(neighbor.id)
                          ? 'Added to your review deck.'
                          : 'Adding to your review deck…'}
                      </p>
                    </div>
                  ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
