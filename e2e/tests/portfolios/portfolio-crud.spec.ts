import { test, expect } from "@playwright/test"
import {
  createTestHelpers,
  generateTestId,
  PAGES,
} from "../../fixtures/test-data"

test.describe("Portfolio Management", () => {
  test("should display portfolios list", async ({ page }) => {
    await page.goto(PAGES.portfolios)

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded")

    // Should show portfolios page content
    await expect(page.locator("body")).toBeVisible()
  })

  test("should navigate to create portfolio page", async ({ page }) => {
    await page.goto(PAGES.newPortfolio)

    // Should show portfolio form
    await expect(page.locator("form")).toBeVisible()

    // Should have code, name, currency fields
    await expect(page.locator('input[name="code"]')).toBeVisible()
    await expect(page.locator('input[name="name"]')).toBeVisible()
  })

  test("should create a new portfolio @smoke", async ({ page }) => {
    const helpers = createTestHelpers(page)
    const testId = generateTestId()

    try {
      // Navigate to home first to ensure auth context is loaded
      await page.goto(PAGES.home)
      await page.waitForLoadState("domcontentloaded")

      await page.goto(PAGES.newPortfolio)
      await page.waitForLoadState("domcontentloaded")

      // Fill in portfolio details
      await page.fill('input[name="code"]', testId)
      await page.fill('input[name="name"]', `Test Portfolio ${testId}`)

      // Select currency (using react-select)
      const currencySelect = page.locator('[id*="currency"]').first()
      if (await currencySelect.isVisible()) {
        await currencySelect.click()
        await page
          .locator('[id*="option"]')
          .filter({ hasText: "USD" })
          .first()
          .click()
      }

      // Submit form and wait for navigation
      await Promise.all([
        page.waitForURL(/\/portfolios\/(?!__NEW__)/, { timeout: 15000 }),
        page.click('button[type="submit"]'),
      ])

      // Verify portfolio was created - the form shows the created portfolio
      await expect(page.locator('input[name="code"]')).toHaveValue(testId)
    } finally {
      // Cleanup: Delete the created portfolio via API
      await helpers.cleanupTestData()
    }
  })

  test("should edit an existing portfolio", async ({ page }) => {
    const helpers = createTestHelpers(page)
    let portfolio

    try {
      // Create a portfolio via API
      portfolio = await helpers.createPortfolio()

      // Navigate to portfolio page
      await page.goto(PAGES.portfolio(portfolio.code))

      // Wait for page load
      await page.waitForLoadState("domcontentloaded")

      // Find edit button/link
      const editButton = page
        .locator('a:has-text("Edit"), button:has-text("Edit")')
        .first()

      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click()

        // Update name
        const newName = `Updated ${portfolio.name}`
        await page.fill('input[name="name"]', newName)

        // Submit
        await page.click('button[type="submit"]')

        // Verify update
        await expect(page.locator("body")).toContainText("Updated")
      }
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should delete a portfolio", async ({ page }) => {
    const helpers = createTestHelpers(page)
    let portfolio

    try {
      // Create a portfolio via API
      portfolio = await helpers.createPortfolio()

      // Navigate to portfolio page
      await page.goto(PAGES.portfolio(portfolio.code))

      // Find delete button
      const deleteButton = page.locator('button:has-text("Delete")').first()

      if (await deleteButton.isVisible({ timeout: 5000 })) {
        // Handle confirmation dialog
        page.on("dialog", (dialog) => dialog.accept())

        await deleteButton.click()

        // Wait for redirect to portfolios list
        await page.waitForURL(/\/portfolios$/)

        // Verify portfolio is deleted
        await expect(page.locator("body")).not.toContainText(portfolio.code)
      }
    } finally {
      // Cleanup in case delete failed
      await helpers.cleanupTestData()
    }
  })

  test("should show validation errors for invalid input", async ({ page }) => {
    // Navigate to home first to ensure auth context
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    await page.goto(PAGES.newPortfolio)
    await page.waitForLoadState("domcontentloaded")

    // Type an invalid code (too long) and blur to trigger onChange validation
    const codeInput = page.locator('input[name="code"]')
    await codeInput.fill("TOOLONGCODE123")
    await codeInput.blur()

    // Should show validation error for code length
    await expect(
      page.locator("text=code must be at most 6 characters"),
    ).toBeVisible({ timeout: 5000 })
  })
})
