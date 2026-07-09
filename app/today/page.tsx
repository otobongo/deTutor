import Link from 'next/link';
import { seedGrammarItems, seedUnits } from '@/db/seed/units';
import { loadVocabSeedFile } from '@/db/seed/seed-vocab';
import { learnerPaths, learnerProfileSchema, type SessionStep } from '@/lib/db/learner';
import { getDataStore } from '@/lib/db/store';
import { composeSession } from '@/lib/lesson/engine';

// The Day view (GT-107 landing target; the full shell arrives with GT-220).
// Composes today's plan from the profile; without a profile it points back
// to onboarding.

export const dynamic = 'force-dynamic';

function describeStep(step: SessionStep): string {
  switch (step.kind) {
    case 'warm-up':
      return step.queueWordIds.length > 0
        ? `Warm-up: ${step.queueWordIds.length} review cards`
        : 'Warm-up: no cards due yet (day one)';
    case 'new-vocabulary':
      return `New vocabulary: ${step.wordIds.length} words (theme: ${step.theme})`;
    case 'grammar-focus':
      return `Grammar focus: ${step.grammarItemId}`;
    case 'skill-practice':
      return `Skill practice: ${step.slot}`;
    case 'wrap-up':
      return 'Wrap-up: scores and tomorrow preview';
  }
}

export default async function TodayPage() {
  const store = getDataStore();
  const [learners, learnerId] = learnerPaths.root().split('/') as [string, string];
  const rawProfile = await store.collection(learners).doc(learnerId).get();
  const profile = rawProfile ? learnerProfileSchema.safeParse(rawProfile) : null;

  if (!profile?.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p>No learner profile yet. Complete onboarding first.</p>
        <Link className="text-blue-700 underline" href="/">
          Go to onboarding
        </Link>
      </main>
    );
  }

  const unit = seedUnits.find((candidate) => candidate.id === profile.data.unitId);
  if (!unit) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Today</h1>
        <p>
          Unit {profile.data.unitId} is not seeded yet. Run npm run seed:curriculum or re-run
          placement.
        </p>
      </main>
    );
  }

  const session = composeSession({
    unit,
    unitGrammarItems: seedGrammarItems.filter((item) => unit.grammarItemIds.includes(item.id)),
    corpus: loadVocabSeedFile(profile.data.level),
    learnedWordIds: new Set<string>(),
    cards: [],
    lastSkillSlot: null,
    poorGrammarItemIds: [],
    now: new Date(),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Today</h1>
      <p data-testid="today-summary">
        Unit {unit.id.toUpperCase()}: {unit.theme}. Your daily plan, 15 to 20 minutes.
      </p>
      <ol className="flex list-decimal flex-col gap-2 pl-6" data-testid="day-plan">
        {session.steps.map((step) => (
          <li key={step.kind} data-testid={`step-${step.kind}`}>
            {describeStep(step)}
          </li>
        ))}
      </ol>
      <Link
        className="self-start rounded bg-blue-700 px-4 py-2 text-white"
        href="/today/session"
        data-testid="start-session"
      >
        Start today&apos;s session
      </Link>
    </main>
  );
}
