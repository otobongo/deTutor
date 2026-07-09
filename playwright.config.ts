import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The dev-file store is shared state; journeys run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
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
    },
  },
});
