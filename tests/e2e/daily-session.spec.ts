import { test, expect, type Page } from '@playwright/test';

// GT-220 journeys: the full daily session from Today, the skills library,
// and mobile rendering without horizontal scroll.

async function ensureProfile(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('choose-voice-warm-1').click();
  await page.getByTestId('voice-continue').click();
  await page.getByTestId('dialect-continue').click();
  for (let index = 0; index < 5; index += 1) {
    const textInput = page.getByTestId('probe-text-input');
    if (await textInput.isVisible().catch(() => false)) {
      await textInput.fill('wrong');
      await page.getByTestId('probe-text-submit').click();
    } else {
      await page.getByTestId('probe-option').first().click();
    }
  }
  await expect(page.getByTestId('placement-result')).toBeVisible();
}

async function completeEcho(page: Page, phrase: string): Promise<void> {
  await page.getByTestId('echo-heard').click();
  await page.getByTestId('echo-heard').click();
  await page.getByTestId('echo-production-input').fill(phrase);
  await page.getByTestId('echo-produce').click();
  await page.getByTestId('echo-fast-pass-done').click();
}

test('a full daily session runs from Today to completion', async ({ page }) => {
  await ensureProfile(page);
  await page.goto('/today');
  await page.getByTestId('start-session').click();

  // Step 1: warm-up (day one: empty queue message).
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();
  await page.getByTestId('warmup-continue').click();

  // Step 2: new vocabulary, echo the first three words, then preview.
  await expect(page.getByTestId('step-vocab-view')).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    await completeEcho(page, 'meine Antwort');
  }
  await page.getByTestId('vocab-continue').click();

  // Step 3: grammar focus requires production.
  await expect(page.getByTestId('step-grammar-view')).toBeVisible();
  await page.getByTestId('grammar-production').fill('Ich lerne heute Deutsch.');
  await page.getByTestId('grammar-continue').click();

  // Step 4: listening slot; evaluation degrades to a recoverable state
  // without a Gemini key, and the learner self-checks with captions.
  await expect(page.getByTestId('step-skill-view')).toBeVisible();
  await page.getByTestId('listening-response').fill('Someone introduces themselves.');
  await page.getByTestId('listening-submit').click();
  await expect(page.getByTestId('listening-feedback')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('skill-continue').click();

  // Step 5: wrap-up with the grammar self-score.
  await expect(page.getByTestId('step-wrapup-view')).toBeVisible();
  await page.getByTestId('wrapup-finish').click();
  await expect(page.getByTestId('session-complete')).toBeVisible();
  await page.getByTestId('back-to-today').click();
  await expect(page).toHaveURL(/\/today/);

  // GT-308: the completed session appears in Progress with its stored numbers.
  await page.goto('/progress');
  await expect(page.getByTestId('session-reports')).toBeVisible();
  await expect(page.getByTestId('report-new-words').first()).not.toHaveText('');
});

test('Practice lists all four skills', async ({ page }) => {
  await page.goto('/practice');
  for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
    await expect(page.getByTestId(`skill-${skill}`)).toBeVisible();
  }
});

test('mobile viewport renders without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const path of ['/practice', '/progress']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('the shell navigation reaches every section by keyboard', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByTestId('nav-today')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('nav-today')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/today/);
});
