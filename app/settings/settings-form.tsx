'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LearnerProfile } from '@/lib/db/learner';
import { updateSettings } from '../actions/settings';

// Settings form (GT-204): image style (Mixed default), voice, dialect, and
// the placement re-run entry point. Style changes swap cached asset keys
// instantly; no media regenerates.

const IMAGE_STYLES = [
  { value: 'flat', label: 'Flat' },
  { value: 'render', label: '3D-style' },
  { value: 'mixed', label: 'Mixed (recommended)' },
] as const;

const VOICES = ['warm-1', 'neutral-1', 'energetic-1'] as const;

export function SettingsForm({ profile }: { profile: LearnerProfile }) {
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
      className="flex max-w-md flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Image style</legend>
        {IMAGE_STYLES.map((style) => (
          <label key={style.value} className="flex items-center gap-2">
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

      <label className="flex flex-col gap-1">
        <span className="font-medium">Voice</span>
        <select
          className="rounded-md border bg-surface px-3 py-2"
          value={settings.voice}
          onChange={(event) => setSettings({ ...settings, voice: event.target.value })}
          data-testid="settings-voice"
        >
          {VOICES.map((voice) => (
            <option key={voice} value={voice}>
              {voice}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Dialect</span>
        <select
          className="rounded-md border bg-surface px-3 py-2"
          value={settings.dialect}
          onChange={(event) =>
            setSettings({ ...settings, dialect: event.target.value as typeof settings.dialect })
          }
          data-testid="settings-dialect"
        >
          <option value="hochdeutsch">Hochdeutsch</option>
          <option value="berlin">Berlin dialect mode</option>
        </select>
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="rounded-md bg-action px-4 py-2 text-action-inverse"
          data-testid="settings-save"
        >
          Save
        </button>
        {saved ? <span role="status">Saved.</span> : null}
        {error ? <span role="alert">{error}</span> : null}
      </div>

      <Link className="text-ink underline" href="/" data-testid="rerun-placement">
        Re-run the placement check
      </Link>
    </form>
  );
}
