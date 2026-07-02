import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'mobile-chrome',
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'mobile-webkit',
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'pwa-chromium',
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
})
