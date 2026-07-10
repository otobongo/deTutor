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
  await expect(page.getByTestId('theme-toggle')).toBeVisible();

  await expect(page.getByTestId('rerun-placement')).toHaveAttribute('href', '/');
});
