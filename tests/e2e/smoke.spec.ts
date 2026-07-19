import { test, expect } from '@playwright/test';
import { DEFAULT_PROFILE, resetStore } from './helpers';

test('app boots and the onboarding screen renders', async ({ page }) => {
  // A genuine first visit: no profile, so the site root is onboarding.
  resetStore();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Willkommen!' })).toBeVisible();
  await expect(page.getByTestId('onboarding-intro')).toBeVisible();
});

test('a placed learner is sent to Today instead of onboarding again (GT-D4)', async ({ page }) => {
  resetStore({ 'learners/default': DEFAULT_PROFILE });
  await page.goto('/');
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByTestId('day-plan')).toBeVisible();
});

test('the wordmark returns to Today rather than the onboarding route (GT-D4)', async ({ page }) => {
  resetStore({ 'learners/default': DEFAULT_PROFILE });
  await page.goto('/practice');
  await page.getByTestId('nav-home').click();
  await expect(page).toHaveURL(/\/today/);
});
