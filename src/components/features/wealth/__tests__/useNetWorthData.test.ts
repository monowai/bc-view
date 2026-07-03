/**
 * Unit tests for useNetWorthData holdings-URL scoping.
 *
 * Asserts that the aggregated-holdings SWR key includes ids=<included ids>
 * when excludedPortfolioIds is provided, and that the excluded portfolio id
 * is absent from the URL. Also covers the null-key guard that prevents the
 * svc-position "no ids = all portfolios" fallback while portfolios load.
 */
import { renderHook } from "@testing-library/react"
import useSwr from "swr"
import { useNetWorthData } from "../useNetWorthData"

jest.mock("swr")

jest.mock("@hooks/useFxRates", () => ({
  useFxRates: () => ({
    displayCurrency: { code: "USD", symbol: "$", name: "US Dollar" },
    setDisplayCurrency: jest.fn(),
    fxRates: { USD: 1 },
    fxReady: true,
  }),
}))

jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({ configs: [] }),
}))

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildSwrMock(
  calls: Record<number, Partial<ReturnType<typeof useSwr>>>,
) {
  let callIndex = 0
  mockUseSwr.mockImplementation(() => {
    const idx = callIndex++
    const base = {
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useSwr>
    return { ...base, ...(calls[idx] ?? {}) } as ReturnType<typeof useSwr>
  })
}

type StubPortfolio = {
  id: string
  code: string
  base: { id: string; code: string; symbol: string; name: string }
  currency: { id: string; code: string; symbol: string; name: string }
  marketValue: number
}

function makePortfolio(id: string, code: string): StubPortfolio {
  const usd = { id: "usd", code: "USD", symbol: "$", name: "US Dollar" }
  return { id, code, base: usd, currency: usd, marketValue: 10000 }
}

// SWR call ordering inside useNetWorthData (with useFxRates + usePrivateAssetConfigs mocked):
//   index 0 → portfoliosKey (portfolios)
//   index 1 → holdingKeyUrl (aggregated holdings)
//   index 2 → ccyKey (currencies)
const HOLDINGS_SWR_CALL_INDEX = 1

describe("useNetWorthData — holdings URL scoping", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  describe("when excludedPortfolioIds is not provided", () => {
    it("uses the unscoped holdings URL (no ids param)", () => {
      buildSwrMock({
        0: { data: { data: [makePortfolio("pf-1", "ALPHA")] } },
      })
      renderHook(() => useNetWorthData())
      const holdingsKey = mockUseSwr.mock.calls[HOLDINGS_SWR_CALL_INDEX][0]
      expect(holdingsKey).toBe("/api/holdings/aggregated?asAt=today")
    })
  })

  describe("when excludedPortfolioIds is provided", () => {
    it("includes only non-excluded portfolio ids in the holdings URL", () => {
      buildSwrMock({
        0: {
          data: {
            data: [
              makePortfolio("pf-1", "ALPHA"),
              makePortfolio("pf-2", "BETA"),
            ],
          },
        },
      })
      renderHook(() => useNetWorthData(["pf-1"]))

      const holdingsKey = mockUseSwr.mock.calls[
        HOLDINGS_SWR_CALL_INDEX
      ][0] as string
      // Included id present; excluded id absent
      expect(holdingsKey).toContain("ids=")
      const params = new URLSearchParams(holdingsKey.split("?")[1])
      const ids = (params.get("ids") ?? "").split(",")
      expect(ids).toContain("pf-2")
      expect(ids).not.toContain("pf-1")
    })

    it("uses null key (skips fetch) when all portfolios are excluded", () => {
      buildSwrMock({
        0: { data: { data: [makePortfolio("pf-1", "ALPHA")] } },
      })
      renderHook(() => useNetWorthData(["pf-1"]))
      expect(mockUseSwr.mock.calls[HOLDINGS_SWR_CALL_INDEX][0]).toBeNull()
    })

    it("uses null key while portfolios are still loading (prevents unscoped fallback)", () => {
      // portfolios loading → portfolios=[] → includedIds=[] → null key
      buildSwrMock({
        0: { data: undefined, isLoading: true },
      })
      renderHook(() => useNetWorthData(["pf-x"]))
      expect(mockUseSwr.mock.calls[HOLDINGS_SWR_CALL_INDEX][0]).toBeNull()
    })

    it("uses null key when excluded ids are empty and no portfolios exist (zero-portfolio path)", () => {
      // Zero-portfolio: portfolios=[], excluded=[] → includedIds=[] → null key
      // (avoids sending ids= with empty value; manual-assets fallback takes over)
      buildSwrMock({
        0: { data: { data: [] } },
      })
      renderHook(() => useNetWorthData([]))
      expect(mockUseSwr.mock.calls[HOLDINGS_SWR_CALL_INDEX][0]).toBeNull()
    })

    it("scopes URL to all portfolio ids when excluded list is empty and portfolios exist", () => {
      buildSwrMock({
        0: {
          data: {
            data: [
              makePortfolio("pf-1", "ALPHA"),
              makePortfolio("pf-2", "BETA"),
            ],
          },
        },
      })
      renderHook(() => useNetWorthData([]))

      const holdingsKey = mockUseSwr.mock.calls[
        HOLDINGS_SWR_CALL_INDEX
      ][0] as string
      const params = new URLSearchParams(holdingsKey.split("?")[1])
      const ids = (params.get("ids") ?? "").split(",")
      expect(ids).toContain("pf-1")
      expect(ids).toContain("pf-2")
    })
  })
})
