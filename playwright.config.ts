import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:8790', viewport: { width: 1280, height: 1100 } },
  webServer: { command: 'node test/serve.mjs', port: 8790, reuseExistingServer: !process.env.CI },
});
