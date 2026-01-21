import { test as setup, expect } from "@playwright/test"
import path from "path"

const authFile = path.join(__dirname, ".auth/user.json")

setup("authenticate via Auth0", async ({ page }) => {
  const username = process.env.E2E_AUTH0_USERNAME
  const password = process.env.E2E_AUTH0_PASSWORD

  if (!username || !password) {
    throw new Error(
      "E2E_AUTH0_USERNAME and E2E_AUTH0_PASSWORD must be set in .env.e2e",
    )
  }

  // Navigate to app which should redirect to login
  await page.goto("/")

  // Wait for Auth0 login page
  await page.waitForURL(/beancounter\.eu\.auth0\.com/)

  // Fill in Auth0 credentials
  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for redirect back to app
  await page.waitForURL(/localhost:3000|kauri\.monowai\.com/)

  // Verify we're logged in by checking for user-related content
  await expect(page.locator("body")).toBeVisible()

  // Save signed-in state
  await page.context().storageState({ path: authFile })
})
