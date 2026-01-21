import { test, expect } from "@playwright/test"
import { PAGES } from "../../fixtures/test-data"

test.describe("Authentication", () => {
  test("should have login flow available", async ({ browser }) => {
    // Create a fresh context without stored auth
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to the login API endpoint directly
    await page.goto("/api/auth/login")

    // Should redirect to Auth0 login page
    await expect(page).toHaveURL(/beancounter\.eu\.auth0\.com/, {
      timeout: 10000,
    })

    await context.close()
  })

  test("should display home page when authenticated", async ({ page }) => {
    // With stored auth from auth.setup.ts
    await page.goto(PAGES.home)

    // Should stay on home page (not redirect to login)
    await expect(page).toHaveURL(/localhost:3000|kauri\.monowai\.com/)

    // Should show welcome message
    await expect(page.locator("h1")).toContainText("Welcome")
  })

  test("should logout successfully", async ({ page }) => {
    await page.goto(PAGES.home)

    // Find and click logout link/button
    // Look for logout in user menu or navigation
    const logoutLink = page
      .locator('a[href*="logout"], button:has-text("Logout")')
      .first()

    if (await logoutLink.isVisible()) {
      await logoutLink.click()

      // After logout, should redirect to home or login
      await expect(page).toHaveURL(/\/$|\/api\/auth\/login/)
    }
  })

  test("should maintain session across page navigations", async ({ page }) => {
    // Navigate to home
    await page.goto(PAGES.home)
    await expect(page.locator("h1")).toContainText("Welcome")

    // Navigate to wealth page
    await page.goto(PAGES.wealth)
    await expect(page).not.toHaveURL(/auth0\.com/)

    // Navigate back to home
    await page.goto(PAGES.home)
    await expect(page.locator("h1")).toContainText("Welcome")
  })
})
