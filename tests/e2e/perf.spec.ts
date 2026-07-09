import { test, expect } from '@playwright/test';
import { completeEcho, completeOnboarding, resetStore } from './helpers';

// GT-403 performance checks. Budgets live in docs/perf.md; the assertions
// here use CI-safe ceilings above the documented local measurements.

test('lesson step transitions stay inside the budget with no layout shift', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);
  await page.goto('/today/session');
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();

  // Collect cumulative layout shift across the step advance.
  await page.evaluate(() => {
    const w = window as unknown as { clsTotal: number };
    w.clsTotal = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const shift = entry as unknown as { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) w.clsTotal += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  const start = Date.now();
  await page.getByTestId('warmup-continue').click();
  await expect(page.getByTestId('step-vocab-view')).toBeVisible();
  const transitionMs = Date.now() - start;
  // Documented local budget: 200ms. CI ceiling leaves headroom for the
  // shared runner; a regression past this is a real problem, not noise.
  expect(transitionMs).toBeLessThan(500);

  // Card advance inside the vocabulary step must not shift layout.
  await completeEcho(page, 'meine Antwort');
  const cls = await page.evaluate(() => (window as unknown as { clsTotal: number }).clsTotal);
  expect(cls).toBeLessThan(0.1);
});

test('navigation to primary views stays fast', async ({ page }) => {
  const budgetMs = 1500;
  for (const path of ['/today', '/practice', '/progress']) {
    const start = Date.now();
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    expect(Date.now() - start, `${path} first render`).toBeLessThan(budgetMs);
  }
});
