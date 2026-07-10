import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeOnboarding, resetStore } from './helpers';

// GT-404 accessibility pass: axe on the core flows, keyboard-only session
// completion, and the article-never-color-alone rule.

async function expectNoViolations(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.length} nodes`,
  );
  expect(summary, `${label} axe violations`).toEqual([]);
}

test('axe finds no WCAG A/AA violations on core flows', async ({ page }) => {
  resetStore();
  await page.goto('/');
  await expectNoViolations(page, 'onboarding');
  await completeOnboarding(page);
  await page.goto('/today');
  await expectNoViolations(page, 'today');
  await page.goto('/today/session');
  await expectNoViolations(page, 'session');
  await page.goto('/progress');
  await expectNoViolations(page, 'progress');
  await page.goto('/settings');
  await expectNoViolations(page, 'settings');
  await page.goto('/practice/speaking');
  await expectNoViolations(page, 'speaking practice');
});

test('a session step completes with keyboard only', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);
  await page.goto('/today/session');
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();
  // Reach and activate the continue button without the mouse.
  await page.getByTestId('warmup-continue').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-vocab-view')).toBeVisible();
  await page.getByTestId('echo-heard').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByTestId('echo-production-input').focus();
  await page.keyboard.type('meine Antwort');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('echo-fast-pass-done')).toBeVisible();
});

test('article identity is never conveyed by color alone', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);
  // Article exercises present der/die/das as literal option text: a
  // grayscale rendering communicates exactly the same information. The
  // color-coded card article is additionally covered by component tests.
  await page.goto('/test');
  await expect(page.getByTestId('unit-test-question')).toContainText('Welcher Artikel');
  const options = await page.getByTestId('unit-test-option').allTextContents();
  expect(options).toEqual(['der', 'die', 'das']);
});
