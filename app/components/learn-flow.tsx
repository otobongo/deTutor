'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { WordExtrasPayload } from '@/app/actions/vocab';
import { gradeFor } from '@/lib/learn/progress';
import { WordWorkspace } from './word-workspace';

// The Learn flow (owner-directed 2026-07-10): read, recite, understand,
// mark, next. One word at a time through a group, starting at the first
// unlearned word; the learner leaves whenever they want and progress is
// already saved. No echo gate here: recitation is the learner's own ritual
// in free study.

export function LearnFlow({
  groupTitle,
  words,
  initiallyLearnedIds,
  loadAudio,
  loadExtras,
  addToDeck,
  mark,
}: {
  groupTitle: string;
  words: readonly VocabularyWord[];
  initiallyLearnedIds: readonly string[];
  loadAudio: (wordId: string) => Promise<AudioAsset | null>;
  loadExtras: (wordId: string) => Promise<WordExtrasPayload | null>;
  addToDeck: (wordIds: readonly string[]) => Promise<number>;
  mark: (wordId: string, learned: boolean) => Promise<void>;
}) {
  const firstUnlearned = words.findIndex((word) => !initiallyLearnedIds.includes(word.id));
  const [index, setIndex] = useState(firstUnlearned === -1 ? 0 : firstUnlearned);
  const [learnedIds, setLearnedIds] = useState<ReadonlySet<string>>(new Set(initiallyLearnedIds));
  // Audio caches per word id, so revisiting a word never refetches and the
  // effect only ever adds state (no synchronous resets).
  const [audioByWord, setAudioByWord] = useState<Record<string, AudioAsset>>({});
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);

  const word = words[index];
  const audio = word ? (audioByWord[word.id] ?? null) : null;

  useEffect(() => {
    if (!word) return undefined;
    let cancelled = false;
    void loadAudio(word.id).then((asset) => {
      if (!cancelled && asset) {
        setAudioByWord((current) =>
          current[word.id] ? current : { ...current, [word.id]: asset },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [word, loadAudio]);

  const percent = words.length === 0 ? 0 : Math.round((100 * learnedIds.size) / words.length);

  function nextIndexFrom(current: number, learned: ReadonlySet<string>): number {
    for (let step = 1; step <= words.length; step += 1) {
      const candidate = (current + step) % words.length;
      const candidateWord = words[candidate];
      if (candidateWord && !learned.has(candidateWord.id)) return candidate;
    }
    return -1;
  }

  async function markAndNext(): Promise<void> {
    if (!word || busy) return;
    setBusy(true);
    await mark(word.id, true);
    const nextLearned = new Set([...learnedIds, word.id]);
    setLearnedIds(nextLearned);
    setBusy(false);
    const next = nextIndexFrom(index, nextLearned);
    if (next === -1) setFinished(true);
    else setIndex(next);
  }

  function skip(): void {
    if (!word) return;
    const next = nextIndexFrom(index, learnedIds);
    if (next === -1 || next === index) setFinished(true);
    else setIndex(next);
  }

  async function unmark(): Promise<void> {
    if (!word || busy) return;
    setBusy(true);
    await mark(word.id, false);
    setLearnedIds((current) => {
      const next = new Set(current);
      next.delete(word.id);
      return next;
    });
    setBusy(false);
  }

  if (finished || words.length === 0 || learnedIds.size === words.length) {
    return (
      <section className="flex flex-col gap-3" data-testid="learn-flow-done">
        <p role="status">
          {learnedIds.size} of {words.length} words in {groupTitle} marked as learned ({percent}%,
          grade {gradeFor(percent)}).
        </p>
        <Link
          className="self-start rounded-md bg-action px-4 py-2 text-action-inverse"
          href="/learn"
          data-testid="learn-back"
        >
          Back to Learn
        </Link>
      </section>
    );
  }

  if (!word) return null;
  const isLearned = learnedIds.has(word.id);

  return (
    <section className="flex flex-col gap-5" data-testid="learn-flow">
      <p className="text-sm text-ink-muted" data-testid="learn-progress">
        {groupTitle}: {learnedIds.size} of {words.length} learned ({percent}%, grade{' '}
        {gradeFor(percent)}). Word {index + 1}.
      </p>

      {audio ? (
        <WordWorkspace
          key={word.id}
          word={word}
          audio={audio}
          echo={false}
          loadExtras={loadExtras}
          addToDeck={addToDeck}
          loadNeighborAudio={loadAudio}
        />
      ) : (
        <p data-testid="learn-word-loading">Preparing {word.german}&hellip;</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-action px-4 py-2 text-action-inverse disabled:opacity-40"
          disabled={busy || audio === null}
          onClick={() => void markAndNext()}
          data-testid="learn-mark-next"
        >
          Mark as learned, next word
        </button>
        <button
          type="button"
          className="rounded-md border border-border-default bg-surface px-4 py-2 disabled:opacity-40"
          disabled={busy}
          onClick={skip}
          data-testid="learn-skip"
        >
          Skip for now
        </button>
        {isLearned ? (
          <button
            type="button"
            className="rounded-md border border-border-default bg-surface px-4 py-2 disabled:opacity-40"
            disabled={busy}
            onClick={() => void unmark()}
            data-testid="learn-unmark"
          >
            Unmark
          </button>
        ) : null}
      </div>
    </section>
  );
}
