import { renderHook } from "@testing-library/react"
import { useWealthSummary } from "../useWealthSummary"
import { Portfolio, HoldingContract } from "types/beancounter"

const SGD = { code: "SGD" } as Portfolio["base"]
const USD = { code: "USD" } as Portfolio["base"]

function portfolio(
  overrides: Partial<Portfolio> & {
    code: string
    marketValue: number
  },
): Portfolio {
  return {
    id: overrides.code,
    name: overrides.code,
    base: SGD,
    currency: SGD,
    irr: 0,
    ...overrides,
  } as Portfolio
}

const NO_SORT = { key: null as string | null, direction: "asc" as const }
const NO_HOLDINGS = undefined as HoldingContract | undefined

describe("useWealthSummary", () => {
  it("returns zeros when there are no portfolios and no custom assets", () => {
    const { result } = renderHook(() =>
      useWealthSummary([], { SGD: 1 }, NO_SORT, NO_HOLDINGS),
    )
    expect(result.current.totalValue).toBe(0)
    expect(result.current.portfolioCount).toBe(0)
  })

  it("sums portfolio market values converted via fxRates", () => {
    const portfolios = [
      portfolio({
        code: "P-SGD",
        marketValue: 37000,
        base: SGD,
        currency: SGD,
      }),
      portfolio({
        code: "P-USD",
        marketValue: 40000,
        base: USD,
        currency: USD,
      }),
    ]
    const fxRates = { SGD: 1, USD: 1.28 }
    const { result } = renderHook(() =>
      useWealthSummary(portfolios, fxRates, NO_SORT, NO_HOLDINGS),
    )
    expect(result.current.totalValue).toBeCloseTo(37000 + 40000 * 1.28, 2)
  })

  it("includes custom-asset balances (e.g. CPF composite) in the net-worth total", () => {
    // Repro: Mary has DBS+UOB+IBKR portfolios totalling SGD 88,200 and a
    // CPF composite asset worth SGD 281,000 sitting outside any portfolio.
    // Pre-fix the Net Worth tile reported SGD 88,200 — CPF was dropped.
    const portfolios = [
      portfolio({
        code: "P-SGD",
        marketValue: 37000,
        base: SGD,
        currency: SGD,
      }),
      portfolio({
        code: "P-USD",
        marketValue: 40000,
        base: USD,
        currency: USD,
      }),
    ]
    const fxRates = { SGD: 1, USD: 1.28 }
    const customAssetTotals = { SGD: 281000 }

    const { result } = renderHook(() =>
      useWealthSummary(
        portfolios,
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        customAssetTotals,
      ),
    )
    expect(result.current.totalValue).toBeCloseTo(
      37000 + 40000 * 1.28 + 281000,
      2,
    )
  })

  it("converts custom-asset balances using their currency's fxRate", () => {
    const fxRates = { USD: 1.28 }
    const customAssetTotals = { USD: 1000 }
    const { result } = renderHook(() =>
      useWealthSummary(
        [
          portfolio({
            code: "P-USD",
            marketValue: 0,
            base: USD,
            currency: USD,
          }),
        ],
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        customAssetTotals,
      ),
    )
    expect(result.current.totalValue).toBeCloseTo(1280, 2)
  })

  it("falls back to rate 1 when a custom-asset currency has no fxRate", () => {
    const fxRates = { SGD: 1 }
    const customAssetTotals = { THB: 500 }
    const { result } = renderHook(() =>
      useWealthSummary(
        [
          portfolio({
            code: "P-SGD",
            marketValue: 0,
            base: SGD,
            currency: SGD,
          }),
        ],
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        customAssetTotals,
      ),
    )
    expect(result.current.totalValue).toBe(500)
  })
})
