import Link from 'next/link';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { getMediaProvider } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { echoAttemptAction } from '@/app/actions/speaking';
import { SpeakingEchoPanel } from '@/app/components/speaking-echo-panel';

// Speaking practice (GT-215 surface): an on-demand echo loop over the
// learner's level corpus, five words a visit, rotating by day so repeat
// visits drill different sounds. Content never exceeds the profile level.

export const dynamic = 'force-dynamic';

const TARGETS_PER_VISIT = 5;

export default async function SpeakingPracticePage() {
  const profile = await loadLearnerProfile(getDataStore());
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Speaking practice</h1>
        <p>
          No learner profile yet.{' '}
          <Link className="text-ink underline" href="/">
            Complete onboarding first.
          </Link>
        </p>
      </main>
    );
  }

  const corpus = loadVocabSeedFile(profile.level);
  // Server components must stay pure; the day ordinal comes from the request
  // date object created once here.
  const now = new Date();
  const dayOrdinal = Math.floor(now.getTime() / 86_400_000);
  const start = (dayOrdinal * TARGETS_PER_VISIT) % Math.max(1, corpus.length);
  const words = [...corpus, ...corpus].slice(start, start + TARGETS_PER_VISIT);

  const provider = getMediaProvider();
  const targets = [];
  for (const word of words) {
    const label = word.article ? `${word.article} ${word.german}` : word.german;
    registerPlaceholderClip(`word-${word.id}`, label);
    targets.push({ word, audio: await provider.getAudio(`word-${word.id}`) });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Speaking practice</h1>
      <p className="text-sm text-ink-muted">
        Hear the word, say it aloud, then type what you said. The tutor checks the sounds that
        matter and moves on kindly after three tries.
      </p>
      <SpeakingEchoPanel targets={targets} attempt={echoAttemptAction} />
      <Link className="self-start text-sm underline" href="/practice">
        Back to Practice
      </Link>
    </main>
  );
}
