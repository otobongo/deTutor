import Link from 'next/link';
import { getUnitTestForCurrentUnit } from '@/app/actions/assessment';
import { UnitTestRunner } from './unit-test-runner';

export const dynamic = 'force-dynamic';

export default async function UnitTestPage() {
  const payload = await getUnitTestForCurrentUnit(1);
  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Unit test</h1>
      {payload ? (
        <>
          <p data-testid="unit-test-intro">
            Unit {payload.unit.id.toUpperCase()}: {payload.unit.theme}. Four skills, 60 per skill
            passes. Failing a skill unlocks targeted remediation, then a retake of that skill only.
          </p>
          <UnitTestRunner initial={payload} />
        </>
      ) : (
        <p>
          No learner profile yet.{' '}
          <Link className="text-ink underline" href="/">
            Complete onboarding first.
          </Link>
        </p>
      )}
    </main>
  );
}
