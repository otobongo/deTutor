import { test, expect } from '@playwright/test';

test('app boots and the onboarding screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen!' })).toBeVisible();
  await expect(page.getByTestId('onboarding-intro')).toBeVisible();
});
