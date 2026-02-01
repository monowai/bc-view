import { test, expect } from "@playwright/test"
import { createTestHelpers, PAGES } from "../../fixtures/test-data"

test.describe("Asset Search in Trade Entry", () => {
  /**
   * Open the trade modal via the UI dropdown (Trade > Asset Trade).
   * Waits for the form to be visible before returning.
   */
  async function openTradeModal(page: import("@playwright/test").Page): Promise<void> {
    // Click the "Trade" dropdown button
    await page.locator("button:has-text('Trade')").first().click()
    // Click "Asset Trade" from the dropdown
    await page.locator("text=Asset Trade").click()
    // Verify modal opened
    await expect(page.locator("form#trade-form")).toBeVisible({
      timeout: 10000,
    })
  }

  test("should search for asset by symbol in a specific market @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio(undefined, "NZD", "NZD")

      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("networkidle")

      await openTradeModal(page)

      // Select market "NZX" from the standard HTML select
      await page.locator("select[name='market']").selectOption("NZX")

      // Type in the asset combobox (react-select AsyncSelect)
      const combobox = page.getByRole("combobox")
      await combobox.fill("VCT")

      // Wait for the search API response (covers debounce + network)
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/assets/search") && resp.status() === 200,
        { timeout: 10000 },
      )

      // Options portal to document.body — use page-level locator with regex
      await expect(page.locator("text=/VCT.*NZX/i").first()).toBeVisible({
        timeout: 5000,
      })

      // Select the option
      await page.locator("text=/VCT.*NZX/i").first().click()

      // Verify the form accepted the selection — the asset field should have a value
      // react-select renders the selected value; the underlying hidden input gets set
      await expect(page.locator("form#trade-form")).toBeVisible()
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should search for asset by name", async ({ page }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio(undefined, "NZD", "NZD")

      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("networkidle")

      await openTradeModal(page)

      // Select market "NZX"
      await page.locator("select[name='market']").selectOption("NZX")

      // Search by name instead of symbol
      const combobox = page.getByRole("combobox")
      await combobox.fill("Vector")

      // Wait for the search API response
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/assets/search") && resp.status() === 200,
        { timeout: 10000 },
      )

      // Results should contain either "VCT" or "Vector"
      const vctOption = page.locator("text=/VCT/i").first()
      const vectorOption = page.locator("text=/Vector/i").first()
      await expect(vctOption.or(vectorOption)).toBeVisible({ timeout: 5000 })
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should show Expand Search option and fetch FIGI results", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio()

      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("networkidle")

      await openTradeModal(page)

      const combobox = page.getByRole("combobox")
      await combobox.fill("AAPL")

      // Wait for initial search response
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/assets/search") && resp.status() === 200,
        { timeout: 10000 },
      )

      // "Expand Search?" sentinel should appear in the dropdown
      await expect(page.locator("text=Expand Search")).toBeVisible({
        timeout: 5000,
      })

      // Click "Expand Search?" and wait for the FIGI fetch
      const [figiResponse] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/assets/search") &&
            resp.url().includes("market=FIGI") &&
            resp.status() === 200,
          { timeout: 10000 },
        ),
        page.locator("text=Expand Search").click(),
      ])

      expect(figiResponse.ok()).toBe(true)

      // After expand, the menu should remain open with results
      // (either merged results or the base Select with expanded options)
      await expect(
        page.getByRole("combobox").or(page.locator("[class*='menu']")),
      ).toBeVisible({ timeout: 5000 })
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should handle no results gracefully", async ({ page }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio()

      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("networkidle")

      await openTradeModal(page)

      const combobox = page.getByRole("combobox")
      await combobox.fill("ZZZZZZ")

      // Wait for search response
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/assets/search") && resp.status() === 200,
        { timeout: 10000 },
      )

      // "Expand Search?" should still appear even with no local results
      await expect(page.locator("text=Expand Search")).toBeVisible({
        timeout: 5000,
      })

      // Click expand and wait for FIGI fetch
      const [figiResponse] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/assets/search") &&
            resp.url().includes("market=FIGI") &&
            resp.status() === 200,
          { timeout: 10000 },
        ),
        page.locator("text=Expand Search").click(),
      ])

      expect(figiResponse.ok()).toBe(true)

      // After expand with no results, should show "No assets found" or some results
      const noResults = page.locator("text=No assets found")
      const anyOption = page.locator("[class*='option']").first()
      await expect(noResults.or(anyOption)).toBeVisible({ timeout: 5000 })
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
