'use client';

import { useEffect, useState } from 'react';
import { Button, Chip } from './ui';

// Theme and mode controls (design-system.md sections 1 and 9). Scales live
// in CSS; switching only toggles the lid-mode class and data-lid-theme
// attribute on <html> and persists the choice. The pre-hydration script in
// the layout applies stored values before first paint.
//
// Themes became a picker rather than a two-way toggle with GT-D8, when
// Schiefer joined: a boolean cannot express three choices, and "High
// contrast" as a button label hid what the alternative actually was.

type Mode = 'light' | 'dark';

export const THEMES = [
  { id: 'cal-readwise-hybrid', label: 'Papier', hint: 'Warm neutral, gold accent' },
  { id: 'schiefer', label: 'Schiefer', hint: 'Cool slate, teal accent' },
  { id: 'monochrome-stark', label: 'High contrast', hint: 'Black and white, square edges' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const DEFAULT_THEME: ThemeId = 'cal-readwise-hybrid';

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

function applyMode(mode: Mode): void {
  document.documentElement.classList.toggle('lid-mode-dark', mode === 'dark');
  document.documentElement.classList.toggle('lid-mode-light', mode === 'light');
  localStorage.setItem('lid-mode', mode);
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-lid-theme', theme);
  localStorage.setItem('lid-theme', theme);
}

export function ThemeControls() {
  const [mode, setMode] = useState<Mode>('light');
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  // Sync from the pre-hydration DOM state after mount; queued to avoid a
  // synchronous set-state-in-effect cascade.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMode(document.documentElement.classList.contains('lid-mode-dark') ? 'dark' : 'light');
      const current = document.documentElement.getAttribute('data-lid-theme');
      if (isThemeId(current)) setTheme(current);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Mode</span>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            const next: Mode = mode === 'dark' ? 'light' : 'dark';
            setMode(next);
            applyMode(next);
          }}
          aria-pressed={mode === 'dark'}
          data-testid="mode-toggle"
        >
          {mode === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Theme</legend>
        <div className="flex flex-wrap gap-2" data-testid="theme-picker">
          {THEMES.map((entry) => (
            <Chip
              key={entry.id}
              selected={theme === entry.id}
              onClick={() => {
                setTheme(entry.id);
                applyTheme(entry.id);
              }}
              data-testid={`theme-${entry.id}`}
            >
              {entry.label}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{THEMES.find((entry) => entry.id === theme)?.hint}</p>
      </fieldset>
    </div>
  );
}
