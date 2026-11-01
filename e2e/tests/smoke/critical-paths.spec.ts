import { test, expect } from "@playwright/test"
import {
  createTestHelpers,
  expectPageContent,
  PAGES,
} from "../../fixtures/test-data"

/**
 * Smoke tests covering critical user journeys.
 * Run these with: yarn e2e:smoke
 */
test.describe("Critical User Journeys @smoke", () => {
  test("should render the home page", async ({ page }) => {
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    // The page title, plus a section: "get started" with no data, the
    // Wealth / Independence / Strategy cards with it.
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.locator("h2").first()).toBeVisible()
  })

  test("should create portfolio and view holdings", async ({ page }) => {
    // Navigate first to load auth cookies into page context
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    const helpers = createTestHelpers(page)

    try {
      // Create portfolio via API for reliable setup
      const portfolio = await helpers.createPortfolio()

      // View the portfolio (uses ID in URL)
      await page.goto(PAGES.portfolio(portfolio.id))
      await page.waitForLoadState("domcontentloaded")

      // Should show portfolio edit form with code pre-filled
      const codeInput = page.locator('input[name="code"]')
      await expect(codeInput).toHaveValue(portfolio.code)

      // Navigate to holdings
      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("domcontentloaded")

      await expectPageContent(page)

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
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should navigate to independence planning", async ({ page }) => {
    await page.goto(PAGES.independence)
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should navigate to rebalance models", async ({ page }) => {
    await page.goto(PAGES.rebalance)
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)
  })

  test("should display portfolio list correctly", async ({ page }) => {
    await page.goto(PAGES.portfolios)
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)
  })

  test("should maintain responsive layout on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)

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
    await page.waitForLoadState("domcontentloaded")

    // Should show the 404 page or redirect, not crash
    await expectPageContent(page)
  })

  test("should display user preferences correctly", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForLoadState("domcontentloaded")

    await expectPageContent(page)
  })

  test("should handle concurrent navigation", async ({ page }) => {
    // Rapid navigation between pages
    await page.goto(PAGES.home)
    await page.goto(PAGES.wealth)
    await page.goto(PAGES.portfolios)
    await page.goto(PAGES.home)

    await page.waitForLoadState("domcontentloaded")

    // Should end up on a valid page without errors
    await expectPageContent(page)
    const criticalError = page.locator(
      '.critical-error, [role="alert"]:has-text("critical")',
    )
    const hasCriticalError = await criticalError
      .isVisible({ timeout: 1000 })
      .catch(() => false)
    expect(hasCriticalError).toBe(false)
  })
})
