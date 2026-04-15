import { defineConfig, devices } from '@playwright/test';
import { register } from 'tsconfig-paths';
import { resolve } from 'path';

register({
  baseUrl: resolve(__dirname),
  paths: {
    '@utils/*': ['./utils/*'],
    '@config/*': ['./config/*'],
  }
});

const isCI = !!process.env.CI;

export default defineConfig({
  globalSetup: './utils/global-setup.ts',
  globalTeardown: './utils/global-teardown.ts',
  testDir: './tests',
  testMatch: ['**/*.spec.ts'],
  timeout: 60 * 1000,
  expect: { timeout: 10000 },
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? '50%' : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'target/test-results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://webpmaqa.azurewebsites.net',
    actionTimeout: 15000,
    viewport: { width: 430, height: 932 },
    headless: true,

    launchOptions: {
      slowMo: isCI ? 0 : 300
    },

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'Mobile-Chromium',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'Mobile-Firefox',
      use: {
        browserName: 'firefox',
        viewport: devices['Pixel 7'].viewport,
        userAgent: devices['Pixel 7'].userAgent,
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
});