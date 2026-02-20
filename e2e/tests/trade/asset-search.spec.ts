import { test, expect } from "@playwright/test"
import {
  createTestHelpers,
  PAGES,
  waitForHoldings,
} from "../../fixtures/test-data"

test.describe("Asset Search in Trade Entry", () => {
  // waitForHoldings polls bc-position until the portfolio is visible,
  // eliminating the bc-data/bc-position sync race condition
  test.describe.configure({ retries: 0 })

  // Trade button is hidden on mobile portrait (mobile-portrait:hidden)
  test.beforeEach(({ page }) => {
    const viewport = page.viewportSize()
    test.skip(
      viewport !== null && viewport.width < 500,
      "Trade button hidden on mobile portrait",
    )
  })

  /**
   * Navigate to holdings and wait for the page to load successfully.
   * Throws if the backend returns an error (transient sync issue).
   */
  async function navigateToHoldings(
    page: import("@playwright/test").Page,
    portfolioCode: string,
  ): Promise<void> {
    // Wait for bc-position to resolve the portfolio before navigating
    await waitForHoldings(page, portfolioCode)
    await page.goto(PAGES.holdings(portfolioCode))
    await page.waitForLoadState("domcontentloaded")
    // Wait for the holdings page to load (Trade button appears when page is ready)
    await expect(page.locator("button:has-text('Trade')").first()).toBeVisible({
      timeout: 15000,
    })
  }

  /**
   * Open the trade modal via the UI dropdown (Trade > Asset Trade).
   * Waits for the form to be visible before returning.
   */
  async function openTradeModal(
    page: import("@playwright/test").Page,
  ): Promise<void> {
    // Click the "Trade" dropdown button
    await page.locator("button:has-text('Trade')").first().click()
    // Click "Asset Trade" from the dropdown
    await page.locator("text=Asset Trade").click()
    // Verify modal opened
    await expect(page.locator("form#trade-form")).toBeVisible({
      timeout: 10000,
    })
  }

  /**
   * Type into the asset search react-select.
   * Uses click to focus/open menu, then fill to set the full value.
   * Retries with keyboard.type if fill doesn't trigger the search.
   */
  async function typeInAssetSearch(
    page: import("@playwright/test").Page,
    text: string,
  ): Promise<void> {
    const input = page.locator("#asset-search")
    await input.click()
    // Small wait to let the menu fully open and focus settle
    await page.waitForTimeout(100)
    await input.fill(text)
  }

  test("should search for asset by symbol in a specific market @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio(undefined, "NZD", "NZD")

      await navigateToHoldings(page, portfolio.code)

      await openTradeModal(page)

      // Select market "NZX" from the standard HTML select
      await page.locator("select[name='market']").selectOption("NZX")

      // Type in the asset search
      await typeInAssetSearch(page, "VCT")

      // Wait for dropdown option to appear (portalled to document.body)
      const option = page.getByRole("option", { name: /VCT/i }).first()
      await expect(option).toBeVisible({ timeout: 15000 })

      // Select the option
      await option.click()

      // Verify the form accepted the selection
      await expect(page.locator("form#trade-form")).toBeVisible()
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should search for asset by name", async ({ page }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio(undefined, "NZD", "NZD")

      await navigateToHoldings(page, portfolio.code)

      await openTradeModal(page)

      // Select market "NZX"
      await page.locator("select[name='market']").selectOption("NZX")

      // Search by name instead of symbol
      await typeInAssetSearch(page, "Vector")

      // Results should contain VCT or Vector in an option
      const option = page.getByRole("option", { name: /VCT|Vector/i }).first()
      await expect(option).toBeVisible({ timeout: 15000 })
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("should handle no results gracefully", async ({ page }) => {
    const helpers = createTestHelpers(page)

    try {
      const portfolio = await helpers.createPortfolio(undefined, "NZD", "NZD")

      await navigateToHoldings(page, portfolio.code)

      await openTradeModal(page)

      // Select market "NZX"
      await page.locator("select[name='market']").selectOption("NZX")

      // Type a search term that yields no results
      await typeInAssetSearch(page, "ZZZZZZ")

      // Wait for the debounce + loadOptions to resolve
      // The "No assets found" message should appear in the dropdown
      const noResults = page.locator("text=No assets found")
      await expect(noResults).toBeVisible({ timeout: 15000 })
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
