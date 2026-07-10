import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The dev-file store is shared state; journeys run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Port 3100 and a dedicated store file keep e2e fully isolated from the
    // owner's live dev server on 3000 (which runs the real key and real
    // media provider); reusing that server has broken runs three times.
    // Never reuse: a fresh server always runs the code under test.
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
    // Hermetic placeholder-mode environment: e2e never needs real
    // credentials; the dev-file store backs learner state.
    env: {
      FIREBASE_PROJECT_ID: 'e2e-placeholder',
      FIREBASE_CLIENT_EMAIL: 'e2e@placeholder.local',
      FIREBASE_PRIVATE_KEY: 'e2e-placeholder-key',
      GEMINI_API_KEY: 'e2e-placeholder-key',
      // The GT-504 flip regression runs the same suite with
      // E2E_MEDIA_PROVIDER=gemini; placeholder is the default.
      MEDIA_PROVIDER: process.env.E2E_MEDIA_PROVIDER ?? 'placeholder',
      DATA_STORE: 'dev-file',
      DEV_STORE_FILE: '.dev-data/e2e-store.json',
    },
  },
});
