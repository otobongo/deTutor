import { test, expect } from '@playwright/test';
import { DEFAULT_PROFILE, resetStore } from './helpers';

// GT-401 journey 4: a decayed unit resurfaces remediation in the daily plan.
// The spec seeds the decayed retention state directly through the dev-file
// store (the same document shape the retest scheduler writes), then asserts
// the Today plan reacts.

test('retention decay inserts remediation into the daily plan', async ({ page }) => {
  resetStore({
    'learners/default': { ...DEFAULT_PROFILE, unitId: 'a1-4' },
    // Two failed retests dropped a1-1 below the threshold (GT-305 math).
    'learners/default/retentionScores/a1-1': {
      unitId: 'a1-1',
      score: 50,
      lastRetestAt: '2026-07-08T08:00:00.000Z',
    },
  });

  await page.goto('/today');
  await expect(page.getByTestId('remediation-notice')).toContainText('A1-1');
  // The plan itself reflects it: the grammar focus targets decayed material.
  await expect(page.getByTestId('step-grammar-focus')).toBeVisible();

  // Recovery: retention back above threshold removes the remediation notice.
  resetStore({
    'learners/default': { ...DEFAULT_PROFILE, unitId: 'a1-4' },
    'learners/default/retentionScores/a1-1': {
      unitId: 'a1-1',
      score: 80,
      lastRetestAt: '2026-07-09T08:00:00.000Z',
    },
  });
  await page.reload();
  await expect(page.getByTestId('remediation-notice')).toHaveCount(0);
});
