import Link from 'next/link';
import { loadProfile } from '../actions/settings';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await loadProfile();
  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Settings</h1>
      {profile ? (
        <SettingsForm profile={profile} />
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
