import Link from 'next/link';
import { getTodaySession } from '@/app/actions/lesson';
import { SessionRunner } from './session-runner';

export const dynamic = 'force-dynamic';

export default async function SessionPage() {
  const payload = await getTodaySession();
  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-4 p-8">
        <h1 className="text-3xl font-semibold">Today&apos;s session</h1>
        <p>
          No learner profile yet.{' '}
          <Link className="text-ink underline" href="/">
            Complete onboarding first.
          </Link>
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">
        Today&apos;s session: {payload.unit.id.toUpperCase()}
      </h1>
      <SessionRunner payload={payload} />
    </main>
  );
}
