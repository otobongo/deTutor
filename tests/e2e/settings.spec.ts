import { test, expect } from '@playwright/test';
import { completeOnboarding, resetStore } from './helpers';

// GT-204 (consolidated 2026-07-10): every preference lives in Settings with
// its default; edits persist; theme and mode controls live here now; the
// placement re-run entry exists.

test('settings edits persist and placement re-run is reachable', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);

  await page.goto('/settings');
  // Defaults from the slimmed onboarding.
  await expect(page.getByTestId('settings-voice-warm-1')).toBeChecked();
  await expect(page.getByTestId('settings-dialect')).toHaveValue('hochdeutsch');

  await page.getByTestId('settings-voice-energetic-1').check();
  await page.getByTestId('image-style-flat').check();
  await page.getByTestId('settings-dialect').selectOption('berlin');
  await page.getByTestId('settings-save').click();
  await expect(page.getByRole('status')).toContainText('Saved');

  await page.reload();
  await expect(page.getByTestId('settings-voice-energetic-1')).toBeChecked();
  await expect(page.getByTestId('image-style-flat')).toBeChecked();
  await expect(page.getByTestId('settings-dialect')).toHaveValue('berlin');

  // Appearance moved here from the header.
  await expect(page.getByTestId('mode-toggle')).toBeVisible();
  await expect(page.getByTestId('theme-picker')).toBeVisible();

  await expect(page.getByTestId('rerun-placement')).toHaveAttribute('href', '/');
});

test('a chosen theme applies immediately and survives a reload (GT-D8)', async ({ page }) => {
  resetStore();
  await page.goto('/settings');

  await page.getByTestId('theme-schiefer').click();
  await expect(page.locator('html')).toHaveAttribute('data-lid-theme', 'schiefer');
  await expect(page.getByTestId('theme-schiefer')).toHaveAttribute('aria-pressed', 'true');

  // The pre-hydration script must whitelist the theme, or a reload paints
  // the default first and the choice appears to have been forgotten.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-lid-theme', 'schiefer');
  await expect(page.getByTestId('theme-schiefer')).toHaveAttribute('aria-pressed', 'true');

  // Switching back is reachable, so the picker is not a one-way door.
  await page.getByTestId('theme-cal-readwise-hybrid').click();
  await expect(page.locator('html')).toHaveAttribute('data-lid-theme', 'cal-readwise-hybrid');
});
