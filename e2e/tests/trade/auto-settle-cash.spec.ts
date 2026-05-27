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

async function fetchPortfolioTrns(
  page: Page,
  portfolioId: string,
): Promise<any[]> {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(`/api/trns/portfolio/${id}`)
    const text = await response.text()
    return { ok: response.ok, status: response.status, body: text }
  }, portfolioId)
  if (!result.ok) {
    throw new Error(`fetchPortfolioTrns failed: ${result.status}`)
  }
  const parsed = JSON.parse(result.body)
  // TrnPayload envelope — flatten the normalised dto list.
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
      const investTrns = await fetchPortfolioTrns(page, invest.id)
      const investAutoLegs = investTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(investAutoLegs).toHaveLength(1)
      expect(investAutoLegs[0].trnType).toBe("DEPOSIT")
      expect(Number(investAutoLegs[0].tradeAmount)).toBeCloseTo(2000, 2)

      // And the matching WITHDRAWAL in master.
      const masterTrns = await fetchPortfolioTrns(page, master.id)
      const masterAutoLegs = masterTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(masterAutoLegs).toHaveLength(1)
      expect(masterAutoLegs[0].trnType).toBe("WITHDRAWAL")
      expect(Number(masterAutoLegs[0].tradeAmount)).toBeCloseTo(2000, 2)

      // Group key: BC-AUTO trns share batch == parent BUY's callerId.
      const buyDto = investTrns.find(
        (t: any) => t.trnType === "BUY" && t.assetId === assetId,
      )
      expect(buyDto?.callerRef?.callerId).toBeTruthy()
      expect(investAutoLegs[0].callerRef.batch).toBe(
        buyDto?.callerRef?.callerId,
      )
      expect(masterAutoLegs[0].callerRef.batch).toBe(
        buyDto?.callerRef?.callerId,
      )
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

      const investTrns = await fetchPortfolioTrns(page, invest.id)
      const autoLegs = investTrns.filter(
        (t: any) => t.callerRef?.provider === "BC-AUTO",
      )
      expect(autoLegs).toHaveLength(0)
    } finally {
      await helpers.cleanupTestData()
    }
  })

  test("portfolio edit form exposes Cash Funding Portfolio dropdown", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    try {
      const master = await apiCreatePortfolio(page, generateTestId())
      const invest = await apiCreatePortfolio(page, generateTestId())

      await page.goto(`/portfolios/${invest.id}`)
      await page.waitForLoadState("domcontentloaded")

      // Label is rendered above the react-select dropdown.
      await expect(page.locator("text=Cash Funding Portfolio")).toBeVisible({
        timeout: 10000,
      })

      // The hidden react-select input carries the field name from the
      // Controller. Confirm the option list includes the master portfolio.
      const dropdownTrigger = page
        .locator("text=Cash Funding Portfolio")
        .locator("..")
        .locator(
          ".css-1xc3v61-indicatorContainer, [class*='IndicatorsContainer']",
        )
        .first()
      // Fallback: click anywhere in the placeholder text
      const placeholder = page.locator("text=Use account default (none)")
      if (await placeholder.isVisible()) {
        await placeholder.click()
      } else {
        await dropdownTrigger.click()
      }
      await expect(page.locator(`text=${master.code}`).first()).toBeVisible({
        timeout: 5000,
      })
    } finally {
      await helpers.cleanupTestData()
    }
  })
})
