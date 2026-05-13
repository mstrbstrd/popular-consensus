import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3001",
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
      command: "DATABASE_URL=postgresql://pc:pc@127.0.0.1:5432/popular_consensus pnpm --filter @pc/api start",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "pnpm --filter @pc/web start:e2e",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
