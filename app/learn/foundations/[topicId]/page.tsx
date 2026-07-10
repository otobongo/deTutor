import Link from 'next/link';
import { foundationTopicById } from '@/db/seed/foundations';
import { foundationProgressSchema, learnerPaths } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { getMediaProvider, type AudioAsset } from '@/lib/media';
import { registerPlaceholderClip } from '@/lib/media/placeholder-clips';
import { narratorFor } from '@/lib/media/tts';
import { markFoundationLearnedAction, submitFoundationQuizAction } from '@/app/actions/learn';
import { FoundationStudy } from '@/app/components/foundation-study';

// A foundation study page: sections, tables, audible examples in the
// learner's voice, and the scored self-check.

export const dynamic = 'force-dynamic';

export default async function FoundationPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  const topic = foundationTopicById(topicId);

  if (!profile || !topic) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Learn</h1>
        <p>
          {profile ? 'This topic does not exist.' : 'No learner profile yet.'}{' '}
          <Link className="text-ink underline" href={profile ? '/learn' : '/'}>
            {profile ? 'Back to Learn.' : 'Complete onboarding first.'}
          </Link>
        </p>
      </main>
    );
  }

  // Example audio in the learner's chosen voice, plus a spoken version of
  // each section intro (English) for on-demand listening. Cached like
  // everything else.
  const narrator = narratorFor(profile.settings.voice);
  const provider = getMediaProvider();
  const jobs: Array<{ key: string; clipId: string }> = [];
  topic.sections.forEach((section, sectionIndex) => {
    const introClipId = `found-${topic.id}-s${sectionIndex}-intro`;
    registerPlaceholderClip(introClipId, `${section.heading}. ${section.body}`, {
      lang: 'en-US',
      speakers: narrator,
    });
    jobs.push({ key: `s${sectionIndex}-intro`, clipId: introClipId });
    section.examples?.forEach((example, exampleIndex) => {
      const clipId = `found-${topic.id}-s${sectionIndex}-e${exampleIndex}`;
      registerPlaceholderClip(clipId, example.de, { speakers: narrator });
      jobs.push({ key: `s${sectionIndex}-e${exampleIndex}`, clipId });
    });
  });
  const assets = await Promise.all(jobs.map((job) => provider.getAudio(job.clipId)));
  const exampleAudio: Record<string, AudioAsset> = {};
  jobs.forEach((job, index) => {
    exampleAudio[job.key] = assets[index] as AudioAsset;
  });

  const rawProgress = await store.collection(learnerPaths.foundationProgress()).doc(topic.id).get();
  const parsed = rawProgress ? foundationProgressSchema.safeParse(rawProgress) : null;
  const progress = parsed?.success ? parsed.data : null;

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{topic.title}</h1>
        <p className="text-ink-muted">{topic.blurb}</p>
      </div>
      <FoundationStudy
        topic={topic}
        exampleAudio={exampleAudio}
        initialMarked={progress?.marked ?? false}
        initialBestScore={progress?.bestScore ?? null}
        submitQuiz={submitFoundationQuizAction}
        markLearned={markFoundationLearnedAction}
      />
    </main>
  );
}
