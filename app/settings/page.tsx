import Link from 'next/link';
import { loadProfile } from '../actions/settings';
import { getVoiceOptions, getVoiceSample } from '../actions/onboarding';
import { ThemeControls } from '../components/theme-controls';
import { SettingsForm, type VoiceChoice } from './settings-form';

// Settings (GT-204, consolidated 2026-07-10): the one home for every
// preference, tutor voice with audible samples, dialect, image style, and
// the app's appearance (theme and mode moved here from the header).

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await loadProfile();
  const voiceOptions = await getVoiceOptions();
  const voices: VoiceChoice[] = await Promise.all(
    voiceOptions.map(async (voice) => ({
      id: voice.id,
      name: voice.name,
      group: voice.group,
      sample: await getVoiceSample(voice.id),
    })),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full readable-width flex-col gap-8 p-4 sm:p-8">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      {profile ? (
        <SettingsForm profile={profile} voices={voices} />
      ) : (
        <p>
          No learner profile yet.{' '}
          <Link className="text-ink underline" href="/">
            Complete onboarding first.
          </Link>
        </p>
      )}
      <section className="flex flex-col gap-2 border-t border-border-default pt-6">
        <h2 className="font-medium">Appearance</h2>
        <p className="text-xs text-ink-muted">
          The default follows your system&apos;s light or dark preference.
        </p>
        <ThemeControls />
      </section>
    </main>
  );
}
