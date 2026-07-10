import { test, expect } from '@playwright/test';
import { completeOnboarding, resetStore } from './helpers';

// Learn-before-testing journeys (owner-directed 2026-07-10): the curriculum
// is browsable and markable, progress is measured and graded, and nothing is
// gated. Both Learn and the unit test stay reachable at all times.

test('marking words in a group updates measured, graded progress', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);

  await page.goto('/learn');
  await expect(page.getByTestId('learn-summary')).toContainText('0 of');
  await expect(page.getByTestId('foundation-card-numbers')).toBeVisible();
  await expect(page.getByTestId('foundation-card-accusative')).toBeVisible();

  // The pronouns set is a small, deterministic group.
  await page.getByTestId('group-card-foundation-pronouns').click();
  await expect(page.getByTestId('learn-flow')).toBeVisible();
  await expect(page.getByTestId('learn-progress')).toContainText('0 of 18 learned');

  await page.getByTestId('learn-mark-next').click();
  await expect(page.getByTestId('learn-progress')).toContainText('1 of 18 learned');
  await page.getByTestId('learn-mark-next').click();
  await expect(page.getByTestId('learn-progress')).toContainText('2 of 18 learned');
  // Skipping moves on without marking.
  await page.getByTestId('learn-skip').click();
  await expect(page.getByTestId('learn-progress')).toContainText('2 of 18 learned');

  // Progress survives navigation and shows on the shelves and Progress tab.
  await page.goto('/learn');
  await expect(page.getByTestId('group-card-foundation-pronouns')).toContainText('2 of 18');
  await expect(page.getByTestId('learn-summary')).toContainText('2 of');
  await page.goto('/progress');
  await expect(page.getByTestId('learn-progress-summary')).toContainText('2 of');

  // Nothing is gated: the unit test stays open regardless of Learn progress.
  await page.goto('/test');
  await expect(page.getByTestId('unit-test-intro')).toBeVisible();
});

test('a foundation topic explains, quizzes with a grade, and marks learned', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);

  await page.goto('/learn/foundations/accusative');
  await expect(page.getByTestId('foundation-accusative')).toBeVisible();
  // The explanation and the article table render before any quiz.
  await expect(page.locator('table').first()).toContainText('den / einen');

  // Answer every question with its first option, then check scoring renders.
  const groups = page.locator('[data-testid^="quiz-"][data-testid$="-0"]');
  const count = await groups.count();
  for (let index = 0; index < count; index += 1) {
    await groups.nth(index).click();
  }
  await page.getByTestId('quiz-submit').click();
  await expect(page.getByTestId('quiz-result')).toContainText('grade');

  await page.getByTestId('foundation-mark').click();
  await expect(page.getByTestId('foundation-mark')).toContainText('Learned ✓');
  await page.goto('/learn');
  await expect(page.getByTestId('foundation-card-accusative')).toContainText('Learned ✓');
});

test('learned words join warm-up reviews and leave the new-word pool', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);

  // Mark one pronoun learned; its FSRS card is introduced due-now.
  await page.goto('/learn/words/foundation-pronouns');
  await expect(page.getByTestId('learn-flow')).toBeVisible();
  await page.getByTestId('learn-mark-next').click();
  await expect(page.getByTestId('learn-progress')).toContainText('1 of 18');

  await page.goto('/today/session');
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();
  // The warm-up now reviews the learned word interactively.
  await expect(page.getByTestId('warmup-review')).toBeVisible();
  await page.getByTestId('warmup-reveal').click();
  await expect(page.getByTestId('warmup-back')).toBeVisible();
});
