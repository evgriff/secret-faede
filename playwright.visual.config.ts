import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.visual\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'output/playwright/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    env: {
      VITE_ALLOWED_EMAILS: 'primary.gardener@example.com,partner.gardener@example.com',
      VITE_APP_RUNTIME: 'mock',
      VITE_ENABLE_PWA: 'false',
    },
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
