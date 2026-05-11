import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: /.*\.visual\.ts/,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  outputDir: 'output/playwright/test-results',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    env: {
      VITE_APP_RUNTIME: 'mock',
      VITE_ALLOWED_EMAILS:
        'primary.gardener@example.com,partner.gardener@example.com',
      VITE_ENABLE_PWA: 'false',
    },
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
