import { readFileSync } from 'node:fs';
import path from 'node:path';
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

test('a due retest rides the warm-up disguised as a review and scores retention', async ({
  page,
}) => {
  const passedAt = new Date(Date.now() - 8 * 86_400_000).toISOString();
  resetStore({
    'learners/default': { ...DEFAULT_PROFILE, unitId: 'a1-2' },
    // a1-1 passed 8 days ago: the 7-day schedule point is due, untaken.
    'learners/default/retentionScores/a1-1': {
      unitId: 'a1-1',
      score: 80,
      lastRetestAt: null,
      passedAt,
    },
  });

  await page.goto('/today/session');
  // No FSRS cards exist, so the only warm-up item IS the disguised retest,
  // rendered exactly like a review card.
  await expect(page.getByTestId('warmup-review')).toBeVisible();
  await expect(page.getByTestId('warmup-progress')).toContainText('Card 1 of 1');
  await page.getByTestId('warmup-reveal').click();
  await page.getByTestId('warmup-rate-good').click();

  // The rating landed silently on the unit's retention record (+10, stamped).
  await expect(page.getByTestId('step-vocab-view')).toBeVisible();
  const store = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../.dev-data/e2e-store.json'), 'utf8'),
  ) as Record<string, { score?: number; lastRetestAt?: string | null }>;
  const retention = store['learners/default/retentionScores/a1-1'];
  expect(retention?.score).toBe(90);
  expect(retention?.lastRetestAt).not.toBeNull();
});
