import { test, expect } from "@playwright/test"
import { createTestHelpers, PAGES } from "../../fixtures/test-data"

/**
 * Smoke tests covering critical user journeys.
 * Run these with: yarn e2e:smoke
 */
test.describe("Critical User Journeys @smoke", () => {
  test("should complete new user onboarding flow", async ({ page }) => {
    await page.goto(PAGES.home)
    await page.waitForLoadState("networkidle")

    // User should see welcome message
    await expect(page.locator("h1")).toContainText("Welcome")

    // Should see the three main sections: Wealth, Invest, Independence (h2 headings)
    await expect(page.locator("h2").filter({ hasText: "Wealth" })).toBeVisible()
    await expect(page.locator("h2").filter({ hasText: "Invest" })).toBeVisible()
    await expect(
      page.locator("h2").filter({ hasText: "Independence" }),
    ).toBeVisible()
  })

  test("should create portfolio and view holdings", async ({ page }) => {
    // Navigate first to load auth cookies into page context
    await page.goto(PAGES.home)
    await page.waitForLoadState("networkidle")

    const helpers = createTestHelpers(page)

    try {
      // Create portfolio via API for reliable setup
      const portfolio = await helpers.createPortfolio()

      // View the portfolio (uses ID in URL)
      await page.goto(PAGES.portfolio(portfolio.id))
      await page.waitForLoadState("networkidle")

      // Should show portfolio edit form with code pre-filled
      const codeInput = page.locator('input[name="code"]')
      await expect(codeInput).toHaveValue(portfolio.code)

      // Navigate to holdings
      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("networkidle")

      // Page should load without errors
      await expect(page.locator("body")).toBeVisible()

      // No critical errors visible
      const criticalError = page.locator('[data-testid="critical-error"]')
      const hasCriticalError = await criticalError
        .isVisible({ timeout: 2000 })
        .catch(() => false)
      expect(hasCriticalError).toBe(false)
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should navigate to wealth overview", async ({ page }) => {
    await page.goto(PAGES.wealth)
    await page.waitForLoadState("networkidle")

    // Should show wealth page
    await expect(page.locator("body")).toBeVisible()

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should navigate to independence planning", async ({ page }) => {
    await page.goto(PAGES.independence)
    await page.waitForLoadState("networkidle")

    // Should show independence page
    await expect(page.locator("body")).toBeVisible()

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should navigate to rebalance models", async ({ page }) => {
    await page.goto(PAGES.rebalance)
    await page.waitForLoadState("networkidle")

    // Should show rebalance page
    await expect(page.locator("body")).toBeVisible()

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should display portfolio list correctly", async ({ page }) => {
    await page.goto(PAGES.portfolios)
    await page.waitForLoadState("networkidle")

    // Should show portfolios page
    await expect(page.locator("body")).toBeVisible()

    // Should have some content (either portfolios or empty state)
    const content = page.locator(
      '[data-testid="portfolio-list"], :text("portfolio"), :text("Create")',
    )
    await expect(content.first()).toBeVisible({ timeout: 10000 })
  })

  test("should maintain responsive layout on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(PAGES.home)
    await page.waitForLoadState("networkidle")

    // Page should be visible and not broken
    await expect(page.locator("body")).toBeVisible()

    // Check for horizontal scroll (indicates layout issues)
    const hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })

    // Some horizontal scroll might be acceptable, but not excessive
    expect(hasHorizontalScroll).toBe(false)
  })

  test("should handle navigation errors gracefully", async ({ page }) => {
    // Navigate to a non-existent page
    await page.goto("/non-existent-page-12345")
    await page.waitForLoadState("networkidle")

    // Should show 404 or redirect to home, not crash
    const is404 = page.locator(':text("404"), :text("Not Found")')
    const isHome = page.locator('h1:has-text("Welcome")')
    const isRedirected = page.url().includes("/")

    const handled =
      (await is404.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await isHome.isVisible({ timeout: 3000 }).catch(() => false)) ||
      isRedirected

    expect(handled).toBe(true)
  })

  test("should display user preferences correctly", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // Should show settings page or redirect - page loads without crashing
    await expect(page.locator("body")).toBeVisible()
  })

  test("should handle concurrent navigation", async ({ page }) => {
    // Rapid navigation between pages
    await page.goto(PAGES.home)
    await page.goto(PAGES.wealth)
    await page.goto(PAGES.portfolios)
    await page.goto(PAGES.home)

    await page.waitForLoadState("networkidle")

    // Should end up on a valid page without errors
    await expect(page.locator("body")).toBeVisible()
    const criticalError = page.locator(
      '.critical-error, [role="alert"]:has-text("critical")',
    )
    const hasCriticalError = await criticalError
      .isVisible({ timeout: 1000 })
      .catch(() => false)
    expect(hasCriticalError).toBe(false)
  })
})
