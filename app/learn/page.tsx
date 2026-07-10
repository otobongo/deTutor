import Link from 'next/link';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { FOUNDATION_TOPICS } from '@/db/seed/foundations';
import { allLearnGroups } from '@/db/seed/learn-groups';
import { foundationProgressSchema, learnedWordSchema, learnerPaths } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { loadLearnerProfile } from '@/lib/db/profile';
import { gradeFor, groupProgress } from '@/lib/learn/progress';

// Learn (owner-directed 2026-07-10): the whole curriculum browsable and
// markable, nothing gated. Foundations first (the structures that
// strengthen the words), then every word group with measured, graded
// progress. A1 scope; higher levels show as locked outlines.

export const dynamic = 'force-dynamic';

export default async function LearnPage() {
  const store = getDataStore();
  const profile = await loadLearnerProfile(store);
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Learn</h1>
        <p>
          No learner profile yet.{' '}
          <Link className="text-ink underline" href="/">
            Complete onboarding first.
          </Link>
        </p>
      </main>
    );
  }

  const [rawLearned, rawFoundation] = await Promise.all([
    store.list(learnerPaths.learnedWords()),
    store.list(learnerPaths.foundationProgress()),
  ]);
  const learnedIds = new Set(
    rawLearned
      .map((data) => learnedWordSchema.safeParse(data))
      .flatMap((parsed) => (parsed.success ? [parsed.data.wordId] : [])),
  );
  const foundationByTopic = new Map(
    rawFoundation
      .map((data) => foundationProgressSchema.safeParse(data))
      .flatMap((parsed) => (parsed.success ? [[parsed.data.topicId, parsed.data] as const] : [])),
  );

  const groups = allLearnGroups(loadVocabSeedFile(profile.level));
  const totalWords = groups.reduce((sum, group) => sum + group.words.length, 0);
  const totalLearned = groups.reduce(
    (sum, group) => sum + group.words.filter((word) => learnedIds.has(word.id)).length,
    0,
  );
  const overallPercent = totalWords === 0 ? 0 : Math.round((100 * totalLearned) / totalWords);

  return (
    <main className="mx-auto flex min-h-screen w-full shell-width flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Learn</h1>
        <p className="text-ink-muted" data-testid="learn-summary">
          {totalLearned} of {totalWords} A1 words learned ({overallPercent}%, grade{' '}
          {gradeFor(overallPercent)}). Study anything in any order; nothing here is locked, and the
          unit test stays open too.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Foundations</h2>
        <p className="text-sm text-ink-muted">
          The structures that make the words work. Start here: numbers, pronouns, and the two cases
          explain how everything else fits together.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="foundation-shelf">
          {FOUNDATION_TOPICS.map((topic) => {
            const progress = foundationByTopic.get(topic.id);
            return (
              <li key={topic.id}>
                <Link
                  href={`/learn/foundations/${topic.id}`}
                  className="flex h-full flex-col gap-1 rounded-lg border bg-surface p-4 hover:bg-surface-2"
                  data-testid={`foundation-card-${topic.id}`}
                >
                  <span className="font-medium">{topic.title}</span>
                  <span className="text-sm text-ink-muted">{topic.blurb}</span>
                  <span className="mt-auto pt-2 text-xs text-ink-subtle">
                    {progress?.marked ? 'Learned ✓' : 'Not marked yet'}
                    {progress?.bestScore !== null && progress?.bestScore !== undefined
                      ? ` · best ${progress.bestScore}/100 (${gradeFor(progress.bestScore)})`
                      : ' · self-check waiting'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Word groups</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="group-shelf">
          {groups.map((group) => {
            const progress = groupProgress(
              group.words.map((word) => word.id),
              learnedIds,
            );
            return (
              <li key={group.id}>
                <Link
                  href={`/learn/words/${group.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border bg-surface p-4 hover:bg-surface-2"
                  data-testid={`group-card-${group.id}`}
                >
                  <span className="font-medium">{group.title}</span>
                  <span className="text-sm text-ink-muted">
                    {progress.learned} of {progress.total} learned · grade {progress.grade}
                  </span>
                  <span
                    className="h-2 w-full overflow-hidden rounded-pill bg-surface-2"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${group.title} progress`}
                  >
                    <span
                      className="block h-full bg-action"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Ahead of you</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {['A2', 'B1'].map((level) => (
            <li
              key={level}
              className="rounded-lg border border-dashed border-border-default p-4 text-ink-subtle"
            >
              <span className="font-medium">{level}</span>
              <span className="block text-sm">
                Unlocks when your level advances; content arrives then.
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
