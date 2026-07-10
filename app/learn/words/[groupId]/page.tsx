import Link from 'next/link';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { learnGroupById } from '@/db/seed/learn-groups';
import { learnedWordSchema, learnerPaths } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { getWordAudioAction, markWordLearnedAction } from '@/app/actions/learn';
import { getWordExtrasAction } from '@/app/actions/vocab';
import { introduceWordsAction } from '@/app/actions/cards';
import { LearnFlow } from '@/app/components/learn-flow';

// A word group in the Learn flow: one word at a time, mark and move on.

export const dynamic = 'force-dynamic';

export default async function LearnGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  const group = profile ? learnGroupById(loadVocabSeedFile(profile.level), groupId) : null;

  if (!profile || !group) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Learn</h1>
        <p>
          {profile ? 'This group does not exist.' : 'No learner profile yet.'}{' '}
          <Link className="text-ink underline" href={profile ? '/learn' : '/'}>
            {profile ? 'Back to Learn.' : 'Complete onboarding first.'}
          </Link>
        </p>
      </main>
    );
  }

  const rawLearned = await store.list(learnerPaths.learnedWords());
  const groupWordIds = new Set(group.words.map((word) => word.id));
  const learnedIds = rawLearned
    .map((data) => learnedWordSchema.safeParse(data))
    .flatMap((parsed) =>
      parsed.success && groupWordIds.has(parsed.data.wordId) ? [parsed.data.wordId] : [],
    );

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold">{group.title}</h1>
        <Link className="text-sm underline" href="/learn">
          Back to Learn
        </Link>
      </div>
      <LearnFlow
        groupTitle={group.title}
        words={group.words}
        initiallyLearnedIds={learnedIds}
        loadAudio={getWordAudioAction}
        loadExtras={getWordExtrasAction}
        addToDeck={introduceWordsAction}
        mark={markWordLearnedAction}
      />
    </main>
  );
}
