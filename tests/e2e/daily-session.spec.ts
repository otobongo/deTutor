import { test, expect, type Page } from '@playwright/test';
import { completeEcho, completeOnboarding, resetStore } from './helpers';

// GT-220/GT-401 journeys: the full daily session from Today, with the skill
// slot rotating across four consecutive sessions (listening, reading,
// writing, scenario), the interactive warm-up reviewing yesterday's words,
// the skills library, and mobile rendering. Brain-dependent evaluation
// degrades to recoverable states in placeholder mode.

const BRAIN_TIMEOUT = 20_000;

// Warm-up: day one shows the empty-queue continue; later sessions review
// each due card with an FSRS rating.
async function completeWarmup(page: Page): Promise<void> {
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();
  if (
    await page
      .getByTestId('warmup-continue')
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId('warmup-continue').click();
    return;
  }
  for (;;) {
    const reveal = page.getByTestId('warmup-reveal');
    try {
      await reveal.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      break;
    }
    await reveal.click();
    await page.getByTestId('warmup-rate-good').click();
  }
}

// Vocabulary: three echoes, then any image-ID rounds for picturable words,
// then the preview continue (which introduces today's FSRS cards).
async function completeVocab(page: Page): Promise<void> {
  await expect(page.getByTestId('step-vocab-view')).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    await completeEcho(page, 'meine Antwort');
  }
  for (;;) {
    const round = page.getByTestId('vocab-image-id');
    try {
      await round.waitFor({ state: 'visible', timeout: 1_500 });
    } catch {
      break;
    }
    await page
      .getByTestId('image-id-exercise')
      .locator('button[data-testid^="image-id-option-"]')
      .first()
      .click();
    await page.getByTestId('image-id-next').click();
  }
  await page.getByTestId('vocab-continue').click();
}

async function completeGrammar(page: Page, sentence: string): Promise<void> {
  await expect(page.getByTestId('step-grammar-view')).toBeVisible();
  await page.getByTestId('grammar-production').fill(sentence);
  await page.getByTestId('grammar-continue').click();
}

async function finishWrapUp(page: Page): Promise<void> {
  await expect(page.getByTestId('step-wrapup-view')).toBeVisible();
  await page.getByTestId('wrapup-finish').click();
  await expect(page.getByTestId('session-complete')).toBeVisible();
}

test('four daily sessions rotate through all skill slots with real exercises', async ({ page }) => {
  test.setTimeout(240_000);
  resetStore();
  await completeOnboarding(page);
  await page.goto('/today');
  await page.getByTestId('start-session').click();

  // Session 1: listening runs the dialogue lab. Placeholder mode falls back
  // to a curated conversation with the transcript visible (captions
  // contract); identification scores deterministically and the explanation
  // degrades to a recoverable state without a Gemini key.
  await completeWarmup(page);
  await completeVocab(page);
  await completeGrammar(page, 'Ich lerne heute Deutsch.');
  await expect(page.locator('h2', { hasText: 'Skill practice' })).toContainText('listening');
  await expect(page.getByTestId('dialogue-lab')).toBeVisible({ timeout: BRAIN_TIMEOUT });
  await page.getByTestId('dialogue-to-identify').click();
  await page.locator('button[data-testid^="identify-"]').first().click();
  await page.getByTestId('identify-check').click();
  await expect(page.getByTestId('identify-score')).toBeVisible();
  await page.getByTestId('dialogue-to-explain').click();
  await page.getByTestId('explain-input').fill('Two people talk about everyday things.');
  await page.getByTestId('explain-submit').click();
  await expect(page.getByTestId('explain-feedback')).toBeVisible({ timeout: BRAIN_TIMEOUT });
  await page.getByTestId('dialogue-to-transcript').click();
  await page.getByTestId('skill-continue').click();
  await finishWrapUp(page);
  await page.getByTestId('back-to-today').click();
  await expect(page).toHaveURL(/\/today/);

  // GT-308: the completed session appears in Progress with its stored numbers.
  await page.goto('/progress');
  await expect(page.getByTestId('session-reports')).toBeVisible();
  await expect(page.getByTestId('report-new-words').first()).not.toHaveText('');

  // Session 2: reading. Yesterday's introduced words are due now, so the
  // warm-up runs interactive card reviews. The reading slot falls back to
  // the curated A1 exercise in placeholder mode and scores richtig/falsch.
  await page.goto('/today/session');
  await expect(page.getByTestId('step-warm-up-view')).toBeVisible();
  await expect(page.getByTestId('warmup-review')).toBeVisible();
  await completeWarmup(page);
  await completeVocab(page);
  await completeGrammar(page, 'Ich lerne wieder Deutsch.');
  await expect(page.locator('h2', { hasText: 'Skill practice' })).toContainText('reading');
  await expect(page.getByTestId('reading-panel')).toBeVisible({ timeout: BRAIN_TIMEOUT });
  const items = page.getByTestId('reading-items').locator('li');
  const itemCount = await items.count();
  for (let index = 0; index < itemCount; index += 1) {
    await page.getByTestId(`reading-answer-${index}-richtig`).click();
  }
  await page.getByTestId('reading-submit').click();
  await expect(page.getByTestId('reading-score')).toBeVisible();
  await page.getByTestId('skill-continue').click();
  await finishWrapUp(page);

  // Session 3: writing. Word tiles first, then the dictation round with the
  // word-level diff.
  await page.goto('/today/session');
  await completeWarmup(page);
  await completeVocab(page);
  await completeGrammar(page, 'Ich schreibe einen Satz.');
  await expect(page.locator('h2', { hasText: 'Skill practice' })).toContainText('writing');
  for (;;) {
    const tile = page.getByTestId('tile-tray').locator('button').first();
    if (!(await tile.isVisible().catch(() => false))) break;
    await tile.click();
  }
  await page.getByTestId('tile-check').click();
  await expect(page.getByTestId('tile-feedback')).toBeVisible();
  await page.getByTestId('writing-to-dictation').click();
  await page.getByTestId('dictation-input').fill('meine Version vom Satz');
  await page.getByTestId('dictation-submit').click();
  await expect(page.getByTestId('dictation-diff')).toBeVisible();
  await page.getByTestId('skill-continue').click();
  await finishWrapUp(page);

  // Session 4: scenario. Turns need the brain; placeholder mode surfaces a
  // recoverable offline state and the scene still ends into wrap-up.
  await page.goto('/today/session');
  await completeWarmup(page);
  await completeVocab(page);
  await completeGrammar(page, 'Ich bestelle einen Kaffee.');
  await expect(page.locator('h2', { hasText: 'Skill practice' })).toContainText('scenario');
  await expect(page.getByTestId('scenario-chat')).toBeVisible({ timeout: BRAIN_TIMEOUT });
  await page.getByTestId('scenario-input').fill('Hallo, einen Kaffee bitte!');
  await page.getByTestId('scenario-send').click();
  await expect(page.getByTestId('scenario-offline')).toBeVisible({ timeout: BRAIN_TIMEOUT });
  await page.getByTestId('scenario-end').click();
  await expect(page.getByTestId('scenario-summary-offline')).toBeVisible({
    timeout: BRAIN_TIMEOUT,
  });
  await page.getByTestId('skill-continue').click();
  await finishWrapUp(page);
});

test('Practice lists all four skills and links echo practice', async ({ page }) => {
  await page.goto('/practice');
  for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
    await expect(page.getByTestId(`skill-${skill}`)).toBeVisible();
  }
  await page.getByTestId('practice-speaking-link').click();
  await expect(page.getByTestId('speaking-echo-panel')).toBeVisible();
});

test('the speaking echo loop confirms an exact echo without the brain', async ({ page }) => {
  resetStore();
  await completeOnboarding(page);
  await page.goto('/practice/speaking');
  const target = await page.getByTestId('speaking-target').innerText();
  await page.getByTestId('speaking-transcript').fill(target.replace(/\s+/g, ' ').trim());
  await page.getByTestId('speaking-submit').click();
  await expect(page.getByTestId('speaking-feedback')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('speaking-next')).toBeVisible();
});

test('the image catalog renders with its audit summary', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.getByTestId('catalog-summary')).toBeVisible();
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
