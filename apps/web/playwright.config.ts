import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: path.resolve(__dirname, '../api'),
      url: 'http://localhost:3000/health',
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/kok_cache',
        FRONTEND_URL: 'http://localhost:5173',
        MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || 'dummy-api-key-for-e2e',
        E2E_TEST: 'true',
      },
      timeout: 120000,
    },
    {
      command: 'pnpm preview --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
})
