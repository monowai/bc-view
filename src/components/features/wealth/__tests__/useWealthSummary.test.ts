import { renderHook } from "@testing-library/react"
import { useWealthSummary } from "../useWealthSummary"
import { Portfolio, HoldingContract, Position } from "types/beancounter"

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
    expect(result.current.healthcareReserve).toBe(0)
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

  it("adds standalone composite-asset balances (no parent portfolio trn) to net worth", () => {
    // Caller pre-filters customAssetTotals to assets whose parent is NOT
    // in any portfolio (i.e. config-only). The hook just adds them.
    const portfolios = [
      portfolio({
        code: "P-SGD",
        marketValue: 37000,
        base: SGD,
        currency: SGD,
      }),
    ]
    const fxRates = { SGD: 1 }
    const customAssetTotals = { SGD: 100000 }

    const { result } = renderHook(() =>
      useWealthSummary(
        portfolios,
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        customAssetTotals,
      ),
    )
    expect(result.current.totalValue).toBeCloseTo(37000 + 100000, 2)
  })

  it("reports Healthcare Reserve (CPF MA) as an informational subset; totalValue still reconciles with portfolios", () => {
    // Mary's case: SGD portfolio holds the CPF parent (276k incl. MA 58k)
    // plus DBS 75k + UOB 12k → portfolio mv 363k. Total wealth must equal
    // the sum of portfolios; the MA is surfaced separately for the UI but
    // is NOT subtracted from totalValue.
    const portfolios = [
      portfolio({
        code: "SGD",
        marketValue: 363000,
        base: SGD,
        currency: SGD,
      }),
    ]
    const fxRates = { SGD: 1 }
    const healthcareReserveTotals = { SGD: 58000 }

    const { result } = renderHook(() =>
      useWealthSummary(
        portfolios,
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        {},
        healthcareReserveTotals,
      ),
    )
    expect(result.current.totalValue).toBeCloseTo(363000, 2)
    expect(result.current.healthcareReserve).toBeCloseTo(58000, 2)
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

  it("converts Healthcare Reserve using its currency's fxRate; does not change totalValue", () => {
    const fxRates = { SGD: 0.78, USD: 1 }
    const portfolios = [
      portfolio({
        code: "P-USD",
        marketValue: 100000,
        base: USD,
        currency: USD,
      }),
    ]
    const healthcareReserveTotals = { SGD: 58000 }

    const { result } = renderHook(() =>
      useWealthSummary(
        portfolios,
        fxRates,
        NO_SORT,
        NO_HOLDINGS,
        {},
        healthcareReserveTotals,
      ),
    )
    const reserveInDisplay = 58000 * 0.78
    expect(result.current.healthcareReserve).toBeCloseTo(reserveInDisplay, 2)
    expect(result.current.totalValue).toBeCloseTo(100000, 2)
  })

  it("converts classificationBreakdown (liquidity) values via fxRates, not raw BASE marketValue", () => {
    // Selected display currency is SGD. One position priced in SGD (Equity,
    // rate 1) and one in USD (Cash, rate 1.28) — the USD position's
    // marketValue must be converted before being summed into the "Cash"
    // liquidity bucket, matching how totalGainOnDay is already converted.
    function position(overrides: {
      category: string
      currencyCode: string
      marketValue: number
    }): Position {
      return {
        asset: { assetCategory: { name: overrides.category } },
        moneyValues: {
          BASE: {
            marketValue: overrides.marketValue,
            currency: { code: overrides.currencyCode },
          },
        },
      } as unknown as Position
    }

    const holdingsData = {
      positions: {
        "1": position({
          category: "Equity",
          currencyCode: "SGD",
          marketValue: 1000,
        }),
        "2": position({
          category: "Cash",
          currencyCode: "USD",
          marketValue: 1000,
        }),
      },
    } as unknown as HoldingContract

    const fxRates = { SGD: 1, USD: 1.28 }
    const portfolios = [
      portfolio({ code: "P-SGD", marketValue: 2000, base: SGD, currency: SGD }),
    ]

    const { result } = renderHook(() =>
      useWealthSummary(portfolios, fxRates, NO_SORT, holdingsData),
    )

    const investment = result.current.classificationBreakdown.find(
      (c) => c.classification === "Investment",
    )
    const cash = result.current.classificationBreakdown.find(
      (c) => c.classification === "Cash",
    )
    expect(investment?.value).toBeCloseTo(1000, 2)
    expect(cash?.value).toBeCloseTo(1000 * 1.28, 2)
  })
})
