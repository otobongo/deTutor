'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LearnerProfile } from '@/lib/db/learner';
import type { AudioAsset } from '@/lib/media/provider';
import { updateSettings } from '../actions/settings';
import { AudioPlayer } from '../components/audio-player';
import { ActionRow, Button } from '../components/ui';

// Settings form (GT-204, consolidated 2026-07-10): every preference lives
// here with its default labeled. Voice options carry their samples so the
// choice is audible before it is made; style changes swap cached asset keys
// instantly, nothing regenerates.

const IMAGE_STYLES = [
  { value: 'flat', label: 'Flat' },
  { value: 'render', label: '3D-style' },
  { value: 'mixed', label: 'Mixed (default)' },
] as const;

export interface VoiceChoice {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly sample: AudioAsset | null;
}

export function SettingsForm({
  profile,
  voices,
}: {
  profile: LearnerProfile;
  voices: readonly VoiceChoice[];
}) {
  const [settings, setSettings] = useState(profile.settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setSaved(false);
    setError(null);
    try {
      await updateSettings(settings);
      setSaved(true);
    } catch {
      setError('Saving failed. Please try again.');
    }
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 font-medium">Tutor voice</legend>
        <p className="text-xs text-ink-muted">
          Used for all spoken audio: words, sentences, explanations, and live conversation. Warm
          (Mia) is the default.
        </p>
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3">
          {voices.map((voice) => (
            <label
              key={voice.id}
              className={`flex min-h-11 cursor-pointer flex-col gap-2 rounded-lg border p-3 ${
                settings.voice === voice.id
                  ? 'border-border-strong bg-surface-2'
                  : 'border-border-default bg-surface hover:bg-surface-2'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="voice"
                  value={voice.id}
                  checked={settings.voice === voice.id}
                  onChange={() => setSettings({ ...settings, voice: voice.id })}
                  data-testid={`settings-voice-${voice.id}`}
                />
                <span className="font-medium">{voice.name}</span>
                <span className="text-xs text-ink-muted">{voice.group}</span>
              </span>
              {voice.sample ? (
                <AudioPlayer asset={voice.sample} label={`Hear ${voice.name}`} variant="icon" />
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Dialect</span>
        <select
          className="min-h-11 rounded-md border bg-surface px-3 py-2 sm:max-w-xs"
          value={settings.dialect}
          onChange={(event) =>
            setSettings({ ...settings, dialect: event.target.value as typeof settings.dialect })
          }
          data-testid="settings-dialect"
        >
          <option value="hochdeutsch">Hochdeutsch (default)</option>
          <option value="berlin">Berlin dialect mode</option>
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 font-medium">Image style</legend>
        {IMAGE_STYLES.map((style) => (
          <label key={style.value} className="flex min-h-9 items-center gap-2">
            <input
              type="radio"
              name="imageStyle"
              value={style.value}
              checked={settings.imageStyle === style.value}
              onChange={() => setSettings({ ...settings, imageStyle: style.value })}
              data-testid={`image-style-${style.value}`}
            />
            {style.label}
          </label>
        ))}
      </fieldset>

      <ActionRow>
        <Button type="submit" data-testid="settings-save">
          Save
        </Button>
        {saved ? <span role="status">Saved.</span> : null}
        {error ? <span role="alert">{error}</span> : null}
      </ActionRow>

      <Link
        className="self-start text-sm text-ink underline"
        href="/"
        data-testid="rerun-placement"
      >
        Re-run the placement check
      </Link>
    </form>
  );
}
