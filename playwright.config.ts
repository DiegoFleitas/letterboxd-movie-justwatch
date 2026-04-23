import { defineConfig, devices } from "@playwright/test";

const htmlReporterOptions = { outputFolder: "tests/playwright-report" };

export default defineConfig({
  testDir: "./tests/e2e",
  // backend-smoke.spec.ts: E2E_API_BASE_URL (default http://127.0.0.1:3000) — see tests/e2e/README.md
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ["github", {}],
        ["html", htmlReporterOptions],
      ]
    : [["html", htmlReporterOptions]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  outputDir: "tests/test-results",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
