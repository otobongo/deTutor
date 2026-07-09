'use client';

import { useEffect, useState } from 'react';

// Theme and mode controls (design-system.md sections 1 and 9). Scales live
// in CSS; switching only toggles the lid-mode class and data-lid-theme
// attribute on <html> and persists the choice. The pre-hydration script in
// the layout applies stored values before first paint.

type Mode = 'light' | 'dark';
type ThemeId = 'cal-readwise-hybrid' | 'monochrome-stark';

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
  const [theme, setTheme] = useState<ThemeId>('cal-readwise-hybrid');

  // Sync from the pre-hydration DOM state after mount; queued to avoid a
  // synchronous set-state-in-effect cascade.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMode(document.documentElement.classList.contains('lid-mode-dark') ? 'dark' : 'light');
      const current = document.documentElement.getAttribute('data-lid-theme');
      if (current === 'monochrome-stark') setTheme(current);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="ml-auto flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border border-border-default px-2 py-1 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
        onClick={() => {
          const next: Mode = mode === 'dark' ? 'light' : 'dark';
          setMode(next);
          applyMode(next);
        }}
        aria-pressed={mode === 'dark'}
        data-testid="mode-toggle"
      >
        {mode === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button
        type="button"
        className="rounded-md border border-border-default px-2 py-1 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
        onClick={() => {
          const next: ThemeId =
            theme === 'monochrome-stark' ? 'cal-readwise-hybrid' : 'monochrome-stark';
          setTheme(next);
          applyTheme(next);
        }}
        aria-pressed={theme === 'monochrome-stark'}
        data-testid="theme-toggle"
      >
        {theme === 'monochrome-stark' ? 'Default theme' : 'High contrast'}
      </button>
    </span>
  );
}
