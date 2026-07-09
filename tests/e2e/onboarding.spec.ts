import { test, expect, type Page } from '@playwright/test';

// GT-107 journeys. Placement probe content mirrors db/seed/placement-probes.ts.

async function chooseVoiceAndSkipDialect(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('choose-voice-warm-1').click();
  await page.getByTestId('voice-continue').click();
  await page.getByTestId('dialect-continue').click();
}

async function answerA1Stage(page: Page, correctCount: number): Promise<void> {
  const answers: Array<{ correct: string; wrong: string } | { text: string; wrongText: string }> = [
    { correct: 'How you are doing', wrong: 'Where you live' },
    { correct: '17', wrong: '70' },
    { correct: 'I live in Berlin', wrong: 'I work in Berlin' },
    { correct: 'der Tisch', wrong: 'der Stuhl' },
    { text: 'bist', wrongText: 'ist' },
  ];
  for (let index = 0; index < answers.length; index += 1) {
    const answer = answers[index] as (typeof answers)[number];
    const useCorrect = index < correctCount;
    if ('text' in answer) {
      await page.getByTestId('probe-text-input').fill(useCorrect ? answer.text : answer.wrongText);
      await page.getByTestId('probe-text-submit').click();
    } else {
      await page.getByRole('button', { name: useCorrect ? answer.correct : answer.wrong }).click();
    }
  }
}

test('complete onboarding lands on the Day 1 plan', async ({ page }) => {
  await chooseVoiceAndSkipDialect(page);
  await expect(page.getByTestId('probe-prompt')).toBeVisible();
  await answerA1Stage(page, 3);

  await expect(page.getByTestId('placement-result')).toContainText('starting at A1');
  // Skipping dialect defaults to Hochdeutsch.
  await expect(page.getByTestId('profile-summary')).toContainText('hochdeutsch');

  await page.getByTestId('start-day-1').click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByTestId('today-summary')).toContainText('A1-1');
  await expect(page.getByTestId('day-plan')).toBeVisible();
  for (const step of ['warm-up', 'new-vocabulary', 'grammar-focus', 'skill-practice', 'wrap-up']) {
    await expect(page.getByTestId(`step-${step}`)).toBeVisible();
  }
});

test('voice samples play through the media adapter with captions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('play-voice-sample-warm-1').click();
  // Placeholder audio always requires captions; their presence proves the
  // asset came from the adapter, not a direct media call.
  await expect(page.getByTestId('captions-voice-sample-warm-1')).toContainText('Mia');
});

test('a strong A1 stage escalates to the A2 probes', async ({ page }) => {
  await chooseVoiceAndSkipDialect(page);
  await answerA1Stage(page, 5);
  await expect(page.getByRole('heading', { name: /Placement check: A2/ })).toBeVisible();
});
