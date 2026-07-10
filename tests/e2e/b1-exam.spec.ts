import { test, expect } from '@playwright/test';
import { resetStore } from './helpers';

// GT-401 journey 5, extended 2026-07-10: the B1 exam renders the official
// blueprint AND every module is sittable. In placeholder mode the
// deterministic filler provides the content, so a full timed sitting with
// scoring works without the brain.

test('the B1 exam page renders the full Goethe structure', async ({ page }) => {
  await page.goto('/exam');
  await expect(page.getByTestId('exam-intro')).toBeVisible();
  await expect(page.getByTestId('exam-structure-reading')).toContainText('5 parts, 30 items');
  await expect(page.getByTestId('exam-structure-listening')).toContainText('4 parts, 30 items');
  await expect(page.getByTestId('exam-structure-writing')).toContainText('3 production tasks');
  await expect(page.getByTestId('exam-structure-speaking')).toContainText('3 production tasks');
  await expect(page.getByTestId('exam-module-reading')).toContainText('65 minutes');
  await expect(page.getByTestId('exam-module-speaking')).toContainText('15 minutes');
});

test('a full Lesen sitting scores, persists, and shows on the overview', async ({ page }) => {
  test.setTimeout(120_000);
  resetStore();
  await page.goto('/exam/reading');
  await expect(page.getByTestId('exam-module-intro')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('exam-start').click();
  await expect(page.getByTestId('exam-timer')).toBeVisible();

  // Answer all 30 items correctly via the answer-key attribute.
  for (let index = 0; index < 30; index += 1) {
    await page.locator('[data-testid="exam-option"][data-correct="true"]').click();
  }
  await expect(page.getByTestId('exam-module-score')).toContainText('100 / 100');
  await expect(page.getByTestId('exam-module-passed')).toContainText('Bestanden');

  await page.getByTestId('exam-back').click();
  await expect(page.getByTestId('exam-result-reading')).toContainText('100 / 100');
});

test('a Schreiben sitting self-scores against its content points', async ({ page }) => {
  resetStore();
  await page.goto('/exam/writing');
  await expect(page.getByTestId('exam-module-intro')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('exam-start').click();

  // Cover every content point of every task, then submit.
  const checkboxes = page.locator('[data-testid^="exam-task-"]');
  const count = await checkboxes.count();
  for (let index = 0; index < count; index += 1) {
    await checkboxes.nth(index).check();
  }
  await page.getByTestId('exam-submit').click();
  await expect(page.getByTestId('exam-module-score')).toContainText('100 / 100');
  await expect(page.getByTestId('exam-module-passed')).toContainText('Bestanden');
});
