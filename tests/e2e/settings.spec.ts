import { test, expect } from '@playwright/test';

// GT-204: settings reachable, editable, and the placement re-run entry
// exists. Depends on a completed onboarding (profile present) from the
// onboarding spec ordering, so this spec creates its own profile first.

test('settings edits persist and placement re-run is reachable', async ({ page }) => {
  // Ensure a profile exists: run a minimal onboarding.
  await page.goto('/');
  await page.getByTestId('choose-voice-warm-1').click();
  await page.getByTestId('voice-continue').click();
  await page.getByTestId('dialect-continue').click();
  for (let index = 0; index < 5; index += 1) {
    const textInput = page.getByTestId('probe-text-input');
    if (await textInput.isVisible().catch(() => false)) {
      await textInput.fill('wrong');
      await page.getByTestId('probe-text-submit').click();
    } else {
      await page.getByTestId('probe-option').first().click();
    }
  }
  await expect(page.getByTestId('placement-result')).toBeVisible();

  await page.goto('/settings');
  await page.getByTestId('image-style-flat').check();
  await page.getByTestId('settings-dialect').selectOption('berlin');
  await page.getByTestId('settings-save').click();
  await expect(page.getByRole('status')).toContainText('Saved');

  await page.reload();
  await expect(page.getByTestId('image-style-flat')).toBeChecked();
  await expect(page.getByTestId('settings-dialect')).toHaveValue('berlin');

  await expect(page.getByTestId('rerun-placement')).toHaveAttribute('href', '/');
});
