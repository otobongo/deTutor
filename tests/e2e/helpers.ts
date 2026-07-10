import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Shared journey helpers (GT-401). Each journey owns its state: resetStore
// wipes the dev-file store so no journey inherits another's learner.

// e2e owns its own store file (matches DEV_STORE_FILE in playwright.config);
// the owner's local learner data in store.json is never touched by tests.
const storeFile = path.resolve(__dirname, '../../.dev-data/e2e-store.json');

export function resetStore(entries: Record<string, unknown> = {}): void {
  mkdirSync(path.dirname(storeFile), { recursive: true });
  writeFileSync(storeFile, JSON.stringify(entries, null, 2));
}

export const DEFAULT_PROFILE = {
  level: 'A1',
  unitId: 'a1-1',
  settings: { voice: 'warm-1', dialect: 'hochdeutsch', imageStyle: 'mixed' },
};

export async function completeOnboarding(page: Page): Promise<void> {
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

export async function completeEcho(page: Page, phrase: string): Promise<void> {
  await page.getByTestId('echo-heard').click();
  await page.getByTestId('echo-heard').click();
  await page.getByTestId('echo-production-input').fill(phrase);
  await page.getByTestId('echo-produce').click();
  await page.getByTestId('echo-fast-pass-done').click();
}
