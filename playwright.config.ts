import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"

// Load E2E environment variables
dotenv.config({ path: ".env.e2e" })

const isCI = !!process.env.CI
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["html"], ["junit", { outputFile: "reports/e2e-junit.xml" }]]
    : [["html"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    // Auth setup - runs first to establish session
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      testDir: "./e2e",
    },
    // Desktop Chrome
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/user.json"),
      },
      dependencies: ["auth-setup"],
    },
    // Mobile Chrome
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: path.join(__dirname, "e2e/.auth/user.json"),
      },
      dependencies: ["auth-setup"],
    },
  ],

  // Start local dev server before tests
  webServer: {
    command: "yarn dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
})
