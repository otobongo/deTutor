import { test, expect } from '@playwright/test';

// GT-401 journey 5: B1 exam smoke. Structure and timing render from the
// official blueprint.

test('the B1 exam page renders the full Goethe structure', async ({ page }) => {
  await page.goto('/exam');
  await expect(page.getByTestId('exam-intro')).toBeVisible();
  await expect(page.getByTestId('exam-structure-reading')).toContainText('5 parts, 30 items');
  await expect(page.getByTestId('exam-structure-listening')).toContainText('4 parts, 30 items');
  await expect(page.getByTestId('exam-structure-writing')).toContainText('3 production tasks');
  await expect(page.getByTestId('exam-structure-speaking')).toContainText('3 production tasks');
  await expect(page.getByTestId('exam-timer-reading')).toContainText('65 minutes');
  await expect(page.getByTestId('exam-timer-speaking')).toContainText('15 minutes');
});
