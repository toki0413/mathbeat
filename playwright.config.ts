import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 480, height: 900 },
    actionTimeout: 8000,
    navigationTimeout: 15000,
  },
  projects: [
    // CI 默认仅安装 chromium，本地运行 firefox/webkit 前需先执行：
    //   npx playwright install firefox webkit
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        },
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
