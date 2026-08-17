import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 测试：连 vite dev server（5173），由 webServer 复用已启动实例或新启。
 * 后端假定在 8000（vite proxy 已转发 /api → 8000）。
 * 浏览器仅启用 chromium。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
