import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter @pc/api start",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "pnpm --filter @pc/web start:e2e",
      url: "http://localhost:3001",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
