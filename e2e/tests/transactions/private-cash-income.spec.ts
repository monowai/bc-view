import { test, expect } from "@playwright/test"
import {
  createTestHelpers,
  generateTestId,
  PAGES,
  waitForHoldings,
} from "../../fixtures/test-data"

/**
 * Verifies that an Interest (INCOME) transaction on a private SGD cash account
 * settles only to that account — no generic "SGD Balance" position is created.
 * The transaction is entered via the Trade > Cash Transaction UI.
 */
test.describe("Private Cash Income", () => {
  // Trade button is hidden on mobile portrait (mobile-portrait:hidden)
  test.beforeEach(({ page }) => {
    const viewport = page.viewportSize()
    test.skip(
      viewport !== null && viewport.width < 500,
      "Trade button hidden on mobile portrait",
    )
  })

  test("interest on private SGD account does not create generic SGD Balance position", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    const assetCode = `E2E-SGD-${generateTestId()}`

    try {
      // 1. Create an SGD portfolio via API
      const portfolio = await helpers.createPortfolio(undefined, "SGD", "USD")

      // 2. Create a private cash asset (bank account) denominated in SGD via API
      await page.evaluate(
        async ({ code }) => {
          const res = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                [code]: {
                  market: "PRIVATE",
                  code,
                  name: "E2E SGD Savings Account",
                  currency: "SGD",
                  category: "ACCOUNT",
                  owner: "e2e-test",
                },
              },
            }),
          })
          if (!res.ok) {
            const text = await res.text()
            throw new Error(`Failed to create asset: ${res.status} ${text}`)
          }
        },
        { code: assetCode },
      )

      // 3. Navigate to holdings page for this portfolio
      await waitForHoldings(page, portfolio.code)
      await page.goto(PAGES.holdings(portfolio.code))
      await page.waitForLoadState("domcontentloaded")

      // Wait for the Trade button to appear (indicates page is ready)
      await expect(
        page.locator("button:has-text('Trade')").first(),
      ).toBeVisible({ timeout: 15000 })

      // 4. Open Trade dropdown and click "Cash Transaction"
      await page.locator("button:has-text('Trade')").first().click()
      await page.locator("text=Cash Transaction").click()

      // Wait for the CashInputForm modal to appear
      await expect(page.locator("form#cash-form")).toBeVisible({
        timeout: 10000,
      })

      // 5. Select INCOME from the Type dropdown (react-select)
      //    Click the react-select to open its menu, then select INCOME
      const typeSelect = page
        .locator("form#cash-form")
        .locator(".css-13cymwt-control")
        .first()
      await typeSelect.click()
      const incomeOption = page.getByRole("option", { name: "INCOME" })
      await expect(incomeOption).toBeVisible({ timeout: 5000 })
      await incomeOption.click()

      // 6. Select the private bank account from the Account dropdown
      //    The Account field is a native <select> with optgroups
      //    Option value is stripOwnerPrefix(owner.code) = the asset code
      const accountSelect = page.locator("form#cash-form select").first()
      await accountSelect.selectOption(assetCode)

      // 7. Enter amount 150 in the Amount field (MathInput is a text input)
      const amountInput = page
        .locator("form#cash-form")
        .locator('input[inputmode="decimal"]')
        .first()
      await amountInput.click()
      await amountInput.fill("150")

      // 8. Submit the form
      await page.locator('button[type="submit"][form="cash-form"]').click()

      // Wait for modal to close (indicates successful submission)
      await expect(page.locator("form#cash-form")).not.toBeVisible({
        timeout: 15000,
      })

      // 9. Wait for bc-position to process the transaction
      await page.waitForTimeout(2000)

      // 10. Verify positions via API
      const holdings = await page.evaluate(async (code) => {
        for (let attempt = 0; attempt < 15; attempt++) {
          const res = await fetch(`/api/holdings/${code}?asAt=today`)
          if (res.ok) {
            const json = await res.json()
            const positions = json.data?.positions || json.positions || {}
            if (Object.keys(positions).length > 0) return json
          }
          await new Promise((r) => setTimeout(r, 1000))
        }
        throw new Error(
          `Holdings with positions not available after 15 attempts`,
        )
      }, portfolio.code)

      const positions = holdings.data?.positions || holdings.positions || {}
      const positionKeys = Object.keys(positions)

      // Should have exactly 1 position - the private cash account
      expect(positionKeys.length).toBe(1)

      // No generic "SGD BALANCE" position should exist
      const hasSgdBalance = positionKeys.some(
        (key) =>
          key.toUpperCase().includes("SGD BALANCE") ||
          key.toUpperCase().includes("SGD:CASH"),
      )
      expect(hasSgdBalance).toBe(false)

      // The private cash asset position should exist
      const hasPrivateCash = positionKeys.some(
        (key) =>
          key.toUpperCase().includes("E2E-SGD") ||
          key.toUpperCase().includes("PRIVATE"),
      )
      expect(hasPrivateCash).toBe(true)
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
