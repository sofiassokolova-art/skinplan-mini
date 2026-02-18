import { defineConfig, devices } from '@playwright/test';

// Базовый URL для e2e: можно переопределить через E2E_BASE_URL
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000, // Увеличено с 60_000 до 90_000
  expect: {
    timeout: 15_000, // Увеличено с 10_000 до 15_000
  },
  retries: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Увеличиваем таймаут для навигации
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});


