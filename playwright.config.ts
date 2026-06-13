import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"

// Load E2E environment variables
dotenv.config({ path: ".env.e2e" })

const isCI = !!process.env.CI
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e/tests",
  // All specs mutate the same shared test user (me2e@monowai.com): each test
  // cleans up portfolios/plans/settings, seeds data, creates new ones, and
  // verifies. Running in parallel causes cross-worker collisions (duplicate
  // SGD portfolio unique constraints, stomped independence settings, etc).
  // Keep tests serial within a project and use a single worker.
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
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
    // Public / logged-out surfaces (marketing landing). No auth session and no
    // backend dependency — only needs the Next dev server, so this project runs
    // even when the API stack and Auth0 are unavailable. Kept out of the authed
    // projects via testIgnore below (the landing only renders when signed out).
    {
      name: "public",
      testDir: "./e2e/tests/public",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
    // Health check - verify backends are up before anything else
    {
      name: "health-check",
      testMatch: /health-check\.setup\.ts/,
      testDir: "./e2e",
    },
    // Auth setup - runs after health-check to establish session
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      testDir: "./e2e",
      dependencies: ["health-check"],
    },
    // Desktop Chrome
    {
      name: "chromium",
      testIgnore: "**/tests/public/**",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/user.json"),
      },
      dependencies: ["auth-setup"],
    },
    // Mobile Chrome
    {
      name: "mobile-chrome",
      testIgnore: "**/tests/public/**",
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
