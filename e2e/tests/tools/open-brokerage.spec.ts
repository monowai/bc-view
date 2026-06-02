import { test, expect } from "@playwright/test"
import { createTestHelpers, generateTestId } from "../../fixtures/test-data"

test.describe("/tools/open-brokerage", () => {
  test("renders wizard at the Broker step", async ({ page }) => {
    await page.goto("/tools/open-brokerage")
    await expect(
      page.getByRole("heading", { name: /^Broker$/i }),
    ).toBeVisible()
    await expect(page.getByText(/Step 1 of 4/i)).toBeVisible()
  })

  test("is reachable via the escape-hatch link on the onboarding Welcome step", async ({
    page,
  }) => {
    await page.goto("/onboarding")
    await page.waitForLoadState("domcontentloaded")
    await page
      .getByRole("link", { name: /Open Brokerage wizard/i })
      .click()
    await page.waitForURL(/\/tools\/open-brokerage$/)
    await expect(
      page.getByRole("heading", { name: /^Broker$/i }),
    ).toBeVisible()
  })

  test("creates a broker + portfolio with no funding @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    const testId = generateTestId() // E2Exxx — 6 chars
    const brokerName = `E2E Broker ${testId}`
    const portfolioCode = testId
    const portfolioName = `E2E Brokerage ${testId}`

    try {
      // Land on home first to settle auth context
      await page.goto("/")
      await page.waitForLoadState("domcontentloaded")

      await page.goto("/tools/open-brokerage")
      await page.waitForLoadState("domcontentloaded")

      // Step 1 — Broker
      await expect(
        page.getByRole("heading", { name: /^Broker$/i }),
      ).toBeVisible()
      await page.getByLabel(/Broker name/i).fill(brokerName)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 2 — Portfolio
      await expect(
        page.getByRole("heading", { name: /^Portfolio$/i }),
      ).toBeVisible()
      await page.getByLabel(/Portfolio code/i).fill(portfolioCode)
      await page.getByLabel(/Portfolio name/i).fill(portfolioName)
      // Currency defaults to USD
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 3 — Funding: skip
      await expect(
        page.getByRole("heading", { name: /Funding|Deposit/i }),
      ).toBeVisible()
      await page.getByRole("button", { name: /Skip|No deposit/i }).click()

      // Step 4 — Review
      await expect(
        page.getByRole("heading", { name: /^Review$/i }),
      ).toBeVisible()
      await expect(page.getByText(`${brokerName} (new)`)).toBeVisible()
      await expect(
        page.getByText(`${portfolioCode} — ${portfolioName} (USD)`),
      ).toBeVisible()

      await page
        .getByRole("button", { name: /Create|Confirm|Open Brokerage/i })
        .click()

      // Done screen
      await expect(
        page.getByRole("heading", { name: /Done|Complete|Success/i }),
      ).toBeVisible({ timeout: 15000 })

      // Verify portfolio actually persisted via API + register for cleanup
      const result = await page.evaluate(async (code) => {
        const r = await fetch("/api/portfolios")
        if (!r.ok) return null
        const j = await r.json()
        return (
          j.data?.find(
            (p: { code: string; id: string }) => p.code === code,
          ) ?? null
        )
      }, portfolioCode)
      expect(result).not.toBeNull()
      expect(result.code).toBe(portfolioCode)
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("creates a broker + portfolio + DEPOSIT/WITHDRAWAL pair with a source portfolio @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    const sourceCode = generateTestId()

    let sourcePortfolio: { id: string; code: string } | null = null
    try {
      // Seed a USD source portfolio + an initial DEPOSIT so it has cash
      sourcePortfolio = await helpers.createPortfolio(
        `E2E Source ${sourceCode}`,
        "USD",
        "USD",
      )
      const seedOk = await page.evaluate(async (sourceId) => {
        // Ensure a CASH/USD asset exists
        const assetResp = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { USD: { market: "CASH", code: "USD" } },
          }),
        })
        const assetJson = await assetResp.json()
        const cashAssetId = Object.values(
          assetJson.data as Record<string, { id: string }>,
        )[0].id

        const trnResp = await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: sourceId,
            data: [
              {
                assetId: cashAssetId,
                cashAssetId,
                trnType: "DEPOSIT",
                quantity: 10000,
                price: 1,
                tradeCurrency: "USD",
                cashCurrency: "USD",
                cashAmount: 10000,
                tradeDate: new Date().toISOString().split("T")[0],
                status: "SETTLED",
              },
            ],
          }),
        })
        return trnResp.ok
      }, sourcePortfolio.id)
      expect(seedOk).toBeTruthy()

      const testId = generateTestId()
      const brokerName = `E2E Broker ${testId}`
      const newCode = testId
      const newName = `E2E Brokerage ${testId}`

      await page.goto("/tools/open-brokerage")
      await page.waitForLoadState("domcontentloaded")

      // Step 1 — Broker
      await page.getByLabel(/Broker name/i).fill(brokerName)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 2 — Portfolio (USD)
      await page.getByLabel(/Portfolio code/i).fill(newCode)
      await page.getByLabel(/Portfolio name/i).fill(newName)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 3 — Funding from source
      await expect(
        page.getByRole("heading", { name: /Funding|Deposit/i }),
      ).toBeVisible()
      await page.getByLabel(/Amount/i).fill("2500")
      // Select by portfolio id (option `value`) to avoid building a runtime
      // regex from test data (ReDoS lint) and to be resilient to label
      // formatting changes.
      await page.getByLabel(/Source portfolio/i).selectOption(sourcePortfolio.id)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 4 — Review + submit
      await expect(
        page.getByRole("heading", { name: /^Review$/i }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: /Create|Confirm|Open Brokerage/i })
        .click()

      await expect(
        page.getByRole("heading", { name: /Done|Complete|Success/i }),
      ).toBeVisible({ timeout: 20000 })

      // The Done screen reports how many cash transactions were posted
      await expect(page.getByText(/2\s+cash transaction/i)).toBeVisible()
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
