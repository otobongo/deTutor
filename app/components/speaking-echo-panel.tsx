'use client';

import { useEffect, useRef, useState } from 'react';
import type { VocabularyWord } from '@/lib/db/curriculum';
import type { AudioAsset } from '@/lib/media/provider';
import type { EchoAttemptOutcome, EchoSnapshot } from '@/app/actions/speaking';
import { MAX_ATTEMPTS } from '@/lib/exercises/speaking-echo';
import { AudioPlayer } from './audio-player';
import { ActionRow, Button, StatusChip } from './ui';

// Speaking echo practice (GT-215 UI): target by target, the learner hears
// the word, says it, and types what they said (the fallback voice channel);
// the assessment names the specific issue. Three misses move on kindly.

interface EchoTarget {
  readonly word: VocabularyWord;
  readonly audio: AudioAsset;
}

function targetLabel(word: VocabularyWord): string {
  return word.article ? `${word.article} ${word.german}` : word.german;
}

// Keyed by target word id so next() mounts a fresh block and carries focus
// to it, announcing the new target to keyboard and screen-reader users.
function TargetWordBlock({ target }: { target: EchoTarget }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex flex-col gap-2 rounded-lg border bg-surface p-4 outline-none"
    >
      <p className="text-2xl font-medium" lang="de" data-testid="speaking-target">
        {target.word.article ? (
          <span style={{ color: `var(--article-${target.word.article})` }}>
            {target.word.article}{' '}
          </span>
        ) : null}
        {target.word.german}
      </p>
      <p className="text-sm text-ink-muted">{target.word.translation}</p>
      {target.word.ipa ? <p className="font-mono text-sm">{target.word.ipa}</p> : null}
      <AudioPlayer asset={target.audio} label="Hear it" variant="icon" />
    </div>
  );
}

export function SpeakingEchoPanel({
  targets,
  attempt,
}: {
  targets: readonly EchoTarget[];
  attempt: (snapshot: EchoSnapshot, transcript: string) => Promise<EchoAttemptOutcome>;
}) {
  const [index, setIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<EchoSnapshot | null>(null);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [busy, setBusy] = useState(false);

  const target = targets[index];
  if (!target) {
    return (
      <p role="status" data-testid="speaking-done">
        <StatusChip tone="success">Alle geschafft!</StatusChip> You worked through every echo
        target. Come back tomorrow for new words.
      </p>
    );
  }

  const current: EchoSnapshot = snapshot ?? {
    target: targetLabel(target.word),
    attempts: 0,
    status: 'awaiting-response',
  };

  async function submit(): Promise<void> {
    const said = transcript.trim();
    if (said.length === 0 || busy) return;
    setBusy(true);
    const outcome = await attempt(current, said);
    setBusy(false);
    if (!outcome.ok) {
      setFeedback(
        `The assessment brain is not reachable (${outcome.category}). ` +
          'Say it again while comparing with the target, then move on when it feels right.',
      );
      setSettled(true);
      return;
    }
    const { state } = outcome;
    setSnapshot({ target: state.target, attempts: state.attempts, status: state.status });
    setFeedback(
      state.lastAssessment
        ? [
            state.lastAssessment.encouragement,
            state.lastAssessment.missingSounds.length > 0
              ? `Listen for: ${state.lastAssessment.missingSounds.join(', ')}.`
              : null,
            state.lastAssessment.stressNote,
          ]
            .filter(Boolean)
            .join(' ')
        : null,
    );
    setSettled(state.status !== 'awaiting-response');
    setTranscript('');
  }

  function next(): void {
    setIndex(index + 1);
    setSnapshot(null);
    setTranscript('');
    setFeedback(null);
    setSettled(false);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="speaking-echo-panel">
      <p className="text-sm text-ink-muted" data-testid="speaking-progress">
        Word {index + 1} of {targets.length}: attempt {Math.min(current.attempts + 1, MAX_ATTEMPTS)}{' '}
        of {MAX_ATTEMPTS}
      </p>
      <TargetWordBlock key={target.word.id} target={target} />

      {!settled ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            className="w-full rounded-md border bg-surface px-3 py-2"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Say it aloud, then type what you said"
            aria-label="What you said"
            disabled={busy}
            data-testid="speaking-transcript"
          />
          <Button
            type="submit"
            disabled={busy || transcript.trim().length === 0}
            data-testid="speaking-submit"
          >
            Check
          </Button>
        </form>
      ) : null}

      {feedback ? (
        <p role="status" data-testid="speaking-feedback">
          {feedback}
        </p>
      ) : null}

      {settled ? (
        <ActionRow>
          <Button onClick={next} data-testid="speaking-next">
            Next word
          </Button>
        </ActionRow>
      ) : null}
    </div>
  );
}
