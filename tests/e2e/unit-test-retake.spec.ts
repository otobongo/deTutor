import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, resetStore } from './helpers';

// GT-401 journey 3: a unit test with a failed skill, remediation, and a
// single-skill retake, fully in placeholder mode.

async function answerSection(page: Page, correctly: boolean, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const options = page.getByTestId('unit-test-option');
    await expect(options.first()).toBeVisible();
    if (correctly) {
      await page.locator('[data-testid="unit-test-option"][data-correct="true"]').click();
    } else {
      await page.locator('[data-testid="unit-test-option"][data-correct="false"]').first().click();
    }
  }
}

test('a failed skill routes through remediation to a single-skill retake', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);
  await page.goto('/test');
  await expect(page.getByTestId('unit-test-intro')).toBeVisible();

  // Listening: all correct. Count items from the heading "(1 of N)".
  const heading = await page.locator('h2', { hasText: 'listening' }).textContent();
  const listeningCount = Number(/of (\d+)/.exec(heading ?? '')?.[1] ?? '0');
  expect(listeningCount).toBeGreaterThan(0);
  await answerSection(page, true, listeningCount);

  const readingHeading = await page.locator('h2', { hasText: 'reading' }).textContent();
  const readingCount = Number(/of (\d+)/.exec(readingHeading ?? '')?.[1] ?? '0');
  await answerSection(page, false, readingCount);

  // Production self-rubric: cover everything so only reading fails.
  await expect(page.getByTestId('unit-test-production')).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    const box = page.getByTestId(`writing-point-${index}`);
    if (await box.isVisible().catch(() => false)) await box.check();
  }
  for (let index = 0; index < 3; index += 1) {
    const box = page.getByTestId(`speaking-point-${index}`);
    if (await box.isVisible().catch(() => false)) await box.check();
  }
  await page.getByTestId('unit-test-submit').click();

  // Reading failed, everything else passed; retake locked behind remediation.
  await expect(page.getByTestId('result-reading')).toHaveAttribute('data-passed', 'false');
  await expect(page.getByTestId('result-listening')).toHaveAttribute('data-passed', 'true');
  await expect(page.getByTestId('remediation-reading')).toBeVisible();

  // Remediate and retake reading only, this time correctly.
  await page.getByTestId('remediate-and-retake-reading').click();
  await expect(page.getByTestId('unit-test-retake')).toBeVisible({ timeout: 20_000 });
  const retakeHeading = await page.locator('h2', { hasText: 'Retake' }).textContent();
  const retakeCount = Number(/of (\d+)/.exec(retakeHeading ?? '')?.[1] ?? '0');
  for (let index = 0; index < retakeCount; index += 1) {
    await page.locator('[data-testid="retake-option"][data-correct="true"]').click();
  }

  await expect(page.getByTestId('unit-complete')).toBeVisible();
});
