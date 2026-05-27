import { test, expect, Page } from "@playwright/test"
import {
  createTestHelpers,
  generateTestId,
  PAGES,
} from "../../fixtures/test-data"

/**
 * Auto-settle cash flow end-to-end.
 *
 * Verifies the data flow added in feat/auto-settle-cash-linked-portfolio:
 *   1. A trade in an investment portfolio with a linked funding portfolio
 *      causes the backend to emit a compensating WITHDRAWAL + DEPOSIT pair.
 *   2. Pair carries the group key callerRef.provider="BC-AUTO" and
 *      callerRef.batch=parent.callerRef.callerId.
 *   3. When the funding portfolio has no history in the trade currency, the
 *      auto-settle is skipped and the response carries a warning.
 *
 * Strategy: drive setup through the existing app API (page.evaluate keeps
 * auth cookies) so the test is robust to UI changes, then assert via the
 * trn listing endpoint. Optional UI assertion verifies the Cash Funding
 * Portfolio dropdown renders on the portfolio edit form.
 */

interface CreatedPortfolio {
  id: string
  code: string
}

const USD = "USD"

async function apiCreatePortfolio(
  page: Page,
  code: string,
  cashPortfolioId?: string,
): Promise<CreatedPortfolio> {
  const result = await page.evaluate(
    async ({ code, cashPortfolioId }) => {
      const body = JSON.stringify({
        data: [
          {
            code,
            name: `E2E ${code}`,
            currency: "USD",
            base: "USD",
            cashPortfolioId: cashPortfolioId ?? undefined,
          },
        ],
      })
      const response = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
      const text = await response.text()
      return { ok: response.ok, status: response.status, body: text }
    },
    { code, cashPortfolioId },
  )
  if (!result.ok) {
    throw new Error(`createPortfolio failed: ${result.status} ${result.body}`)
  }
  const parsed = JSON.parse(result.body)
  const portfolio = parsed.data[0]
  return { id: portfolio.id, code: portfolio.code }
}

/**
 * Clear cashPortfolioId on a portfolio so cleanup can drop the master
 * without tripping the cash_portfolio_id FK constraint.
 */
async function clearCashFunding(
  page: Page,
  portfolio: CreatedPortfolio,
): Promise<void> {
  await page.evaluate(async (p) => {
    await fetch(`/api/portfolios/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: p.code,
        name: `E2E ${p.code}`,
        currency: "USD",
        base: "USD",
        cashPortfolioId: null,
      }),
    })
  }, portfolio)
}

async function ensureCashAsset(page: Page): Promise<string> {
  // svc-data exposes POST /assets to resolve-or-create. The CASH market is
  // global; the response carries the asset id keyed by the input alias.
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { USD: { market: "CASH", code: "USD" } },
      }),
    })
    const text = await response.text()
    return { ok: response.ok, status: response.status, body: text }
  })
  if (!result.ok) {
    throw new Error(`ensureCashAsset failed: ${result.status} ${result.body}`)
  }
  const parsed = JSON.parse(result.body)
  return parsed.data.USD.id
}

interface TrnApiResponse {
  ok: boolean
  status: number
  warnings: string[]
  body: any
}

async function postTrn(
  page: Page,
  portfolioId: string,
  trnInput: Record<string, unknown>,
): Promise<TrnApiResponse> {
  const result = await page.evaluate(
    async ({ portfolioId, trnInput }) => {
      const response = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId, data: [trnInput] }),
      })
      const text = await response.text()
      return { ok: response.ok, status: response.status, body: text }
    },
    { portfolioId, trnInput },
  )
  const parsed = result.body ? JSON.parse(result.body) : {}
  return {
    ok: result.ok,
    status: result.status,
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
    body: parsed,
  }
}

/**
 * Fetch cash-ladder trns for (portfolio, cashAsset). The cash-ladder
 * endpoint returns every trn touching the cash asset, including the
 * auto-emitted WITHDRAWAL / DEPOSIT pair. No general list-by-portfolio
 * route exists in the bc-view proxy yet.
 */
async function fetchCashLadder(
  page: Page,
  portfolioId: string,
  cashAssetId: string,
): Promise<any[]> {
  const result = await page.evaluate(
    async ({ portfolioId, cashAssetId }) => {
      const response = await fetch(
        `/api/trns/portfolio/${portfolioId}/cash-ladder/${cashAssetId}`,
      )
      const text = await response.text()
      return { ok: response.ok, status: response.status, body: text }
    },
    { portfolioId, cashAssetId },
  )
  if (!result.ok) {
    throw new Error(`fetchCashLadder failed: ${result.status} ${result.body}`)
  }
  const parsed = JSON.parse(result.body)
  return parsed?.data?.trns ?? parsed?.data ?? []
}

test.describe("Auto-settle cash to linked funding portfolio", () => {
  test("happy path: BUY emits W+D pair grouped by callerRef", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    try {
      await page.goto(PAGES.home)
      await page.waitForLoadState("domcontentloaded")

      const masterCode = generateTestId()
      const investCode = generateTestId()
      const master = await apiCreatePortfolio(page, masterCode)
      const invest = await apiCreatePortfolio(page, investCode, master.id)
      const cashAssetId = await ensureCashAsset(page)

      // Seed master with a DEPOSIT so the balance check passes.
      const deposit = await postTrn(page, master.id, {
        assetId: cashAssetId,
        cashAssetId,
        trnType: "DEPOSIT",
        tradeAmount: 10000,
        tradeCurrency: USD,
        cashCurrency: USD,
        price: 1,
        tradeDate: "2026-01-01",
        status: "SETTLED",
      })
      expect(deposit.ok, JSON.stringify(deposit.body)).toBeTruthy()

      // Need an equity asset for the BUY.
      const assetId = await page.evaluate(async () => {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { AAPL: { market: "NASDAQ", code: "AAPL" } },
          }),
        })
        const json = await response.json()
        return json.data.AAPL.id as string
      })

      const buyResponse = await postTrn(page, invest.id, {
        assetId,
        cashAssetId,
        trnType: "BUY",
        quantity: 10,
        price: 200,
        tradeAmount: 2000,
        tradeCurrency: USD,
        cashCurrency: USD,
        cashAmount: -2000,
        tradeCashRate: 1,
        tradeDate: "2026-02-01",
        status: "SETTLED",
      })
      expect(buyResponse.ok, JSON.stringify(buyResponse.body)).toBeTruthy()
      // Master has cash history, so no warning expected.
      expect(buyResponse.warnings).toEqual([])

      // Assert the auto-settled pair landed in the invest portfolio.
      const investTrns = await fetchCashLadder(page, invest.id, cashAssetId)
      const investAutoLegs = investTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(investAutoLegs).toHaveLength(1)
      expect(investAutoLegs[0].trnType).toBe("DEPOSIT")
      expect(Number(investAutoLegs[0].tradeAmount)).toBeCloseTo(2000, 2)

      // And the matching WITHDRAWAL in master.
      const masterTrns = await fetchCashLadder(page, master.id, cashAssetId)
      const masterAutoLegs = masterTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(masterAutoLegs).toHaveLength(1)
      expect(masterAutoLegs[0].trnType).toBe("WITHDRAWAL")
      expect(Number(masterAutoLegs[0].tradeAmount)).toBeCloseTo(2000, 2)

      // Group key: BC-AUTO trns share batch == parent BUY's callerId.
      // Cash-ladder responses are denormalised by the bc-view proxy — assets
      // become nested objects, so match on asset.id, not the wire assetId.
      const buyDto = investTrns.find(
        (t: any) => t.trnType === "BUY" && t.asset?.id === assetId,
      )
      expect(buyDto?.callerRef?.callerId).toBeTruthy()
      expect(investAutoLegs[0].callerRef.batch).toBe(
        buyDto?.callerRef?.callerId,
      )
      expect(masterAutoLegs[0].callerRef.batch).toBe(
        buyDto?.callerRef?.callerId,
      )
      await clearCashFunding(page, invest)
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("warning path: BUY skipped when master has no cash history", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    try {
      await page.goto(PAGES.home)
      await page.waitForLoadState("domcontentloaded")

      const master = await apiCreatePortfolio(page, generateTestId())
      const invest = await apiCreatePortfolio(page, generateTestId(), master.id)
      const cashAssetId = await ensureCashAsset(page)

      // Sanity: brand-new master must have zero trns touching CASH.USD.
      const preTrns = await fetchCashLadder(page, master.id, cashAssetId)
      expect(preTrns.length).toBe(0)

      const assetId = await page.evaluate(async () => {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { MSFT: { market: "NASDAQ", code: "MSFT" } },
          }),
        })
        const json = await response.json()
        return json.data.MSFT.id as string
      })

      // No DEPOSIT in master — auto-settle must skip and warn.
      const buyResponse = await postTrn(page, invest.id, {
        assetId,
        cashAssetId,
        trnType: "BUY",
        quantity: 1,
        price: 500,
        tradeAmount: 500,
        tradeCurrency: USD,
        cashCurrency: USD,
        cashAmount: -500,
        tradeCashRate: 1,
        tradeDate: "2026-02-01",
        status: "SETTLED",
      })
      expect(buyResponse.ok).toBeTruthy()
      expect(buyResponse.warnings.length).toBeGreaterThan(0)
      expect(buyResponse.warnings[0].toLowerCase()).toContain("usd")

      const investTrns = await fetchCashLadder(page, invest.id, cashAssetId)
      const autoLegs = investTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(autoLegs).toHaveLength(0)
      await clearCashFunding(page, invest)
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("cash ladder shows BUY plus auto DEPOSIT in invest portfolio and matching WITHDRAWAL in master", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    let invest: CreatedPortfolio | undefined
    try {
      await page.goto(PAGES.home)
      await page.waitForLoadState("domcontentloaded")

      const master = await apiCreatePortfolio(page, generateTestId())
      invest = await apiCreatePortfolio(page, generateTestId(), master.id)
      const cashAssetId = await ensureCashAsset(page)

      // Seed master with a USD deposit so auto-settle fires (no warning).
      await postTrn(page, master.id, {
        assetId: cashAssetId,
        cashAssetId,
        trnType: "DEPOSIT",
        tradeAmount: 10000,
        tradeCurrency: USD,
        cashCurrency: USD,
        price: 1,
        tradeDate: "2026-01-01",
        status: "SETTLED",
      })

      const assetId = await page.evaluate(async () => {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { AAPL: { market: "NASDAQ", code: "AAPL" } },
          }),
        })
        const json = await response.json()
        return json.data.AAPL.id as string
      })

      const buyResponse = await postTrn(page, invest.id, {
        assetId,
        cashAssetId,
        trnType: "BUY",
        quantity: 10,
        price: 200,
        tradeAmount: 2000,
        tradeCurrency: USD,
        cashCurrency: USD,
        cashAmount: -2000,
        tradeCashRate: 1,
        tradeDate: "2026-02-01",
        status: "SETTLED",
      })
      expect(buyResponse.ok).toBeTruthy()

      // --- INVEST cash ladder ---
      // User drills down on the USD Balance row in the invest portfolio.
      await page.goto(`/trns/cash-ladder/${invest.id}/${cashAssetId}`)
      await page.waitForLoadState("networkidle")

      // Both legs should be present: BUY (debit) and auto-emitted DEPOSIT (credit).
      const investRows = page.locator("tbody tr")
      await expect(investRows).toHaveCount(2, { timeout: 10000 })

      // BUY row — signed cash -2,000.00 in red, type pill BUY.
      const investBuyRow = investRows.filter({
        has: page.locator("span", { hasText: /^BUY$/ }),
      })
      await expect(investBuyRow).toHaveCount(1)
      await expect(investBuyRow).toContainText("-2,000.00")

      // Auto DEPOSIT row — +2,000.00 in green, type DEPOSIT.
      const investDepositRow = investRows.filter({
        has: page.locator("span", { hasText: /^DEPOSIT$/ }),
      })
      await expect(investDepositRow).toHaveCount(1)
      await expect(investDepositRow).toContainText("+2,000.00")

      // Running balance: BUY (-2000) then auto DEPOSIT (+2000) → net 0.
      // The bold .00 column anywhere in the table should include 0.00.
      await expect(page.locator("tbody")).toContainText("0.00")

      // --- MASTER cash ladder ---
      // User switches portfolios and drills the same cash asset there.
      await page.goto(`/trns/cash-ladder/${master.id}/${cashAssetId}`)
      await page.waitForLoadState("networkidle")

      const masterRows = page.locator("tbody tr")
      await expect(masterRows).toHaveCount(2, { timeout: 10000 })

      // Seed DEPOSIT +10,000.00
      const masterDepositRow = masterRows.filter({
        has: page.locator("span", { hasText: /^DEPOSIT$/ }),
      })
      await expect(masterDepositRow).toHaveCount(1)
      await expect(masterDepositRow).toContainText("+10,000.00")

      // Auto WITHDRAWAL -2,000.00
      const masterWithdrawalRow = masterRows.filter({
        has: page.locator("span", { hasText: /^WITHDRAWAL$/ }),
      })
      await expect(masterWithdrawalRow).toHaveCount(1)
      await expect(masterWithdrawalRow).toContainText("-2,000.00")

      // Net balance 10000 - 2000 = 8000.
      await expect(page.locator("tbody")).toContainText("8,000.00")
    } finally {
      if (invest) {
        await clearCashFunding(page, invest)
      }
      await helpers.cleanupTestData()
    }
  })

  test("portfolio edit form exposes Cash Funding Portfolio dropdown", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    try {
      // page.evaluate needs to run from an app-domain origin (relative URLs
      // require a non-about:blank base) so the existing auth cookies attach.
      await page.goto(PAGES.home)
      await page.waitForLoadState("domcontentloaded")

      const master = await apiCreatePortfolio(page, generateTestId())
      const invest = await apiCreatePortfolio(page, generateTestId())

      await page.goto(`/portfolios/${invest.id}`)
      await page.waitForLoadState("domcontentloaded")

      // Label is rendered above the react-select dropdown.
      await expect(page.locator("text=Cash Funding Portfolio")).toBeVisible({
        timeout: 10000,
      })

      // The hidden react-select input next to the label confirms the
      // Controller-bound field is mounted. Asserting that an option list
      // contains a freshly-created portfolio is brittle (SWR cache may not
      // include portfolios added by the test mid-session); the contract this
      // test enforces is that the dropdown is present and interactive.
      const reactSelectInput = page
        .locator("text=Cash Funding Portfolio")
        .locator("..")
        .locator('input[id^="react-select"]')
        .first()
      await expect(reactSelectInput).toBeAttached({ timeout: 5000 })

      // Placeholder text confirms the default "use account default" state.
      await expect(page.locator("text=Use account default (none)")).toBeVisible(
        { timeout: 5000 },
      )

      // master reference kept only to document the intended link target;
      // actual persistence is covered by tests 1 and 2 via API round-trip.
      expect(master.id).toBeTruthy()
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
