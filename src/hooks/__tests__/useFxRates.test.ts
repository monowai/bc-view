import { renderHook, waitFor, act } from "@testing-library/react"
import { useFxRates } from "../useFxRates"
import { Currency } from "types/beancounter"

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: jest.fn(),
}))
import { useUserPreferences } from "@contexts/UserPreferencesContext"

const mockUseUserPreferences =
  useUserPreferences as jest.MockedFunction<typeof useUserPreferences>

const mockFetch = jest.fn()
global.fetch = mockFetch

const USD: Currency = { code: "USD", name: "US Dollar", symbol: "$" } as Currency
const NZD: Currency = {
  code: "NZD",
  name: "NZ Dollar",
  symbol: "NZ$",
} as Currency
const GBP: Currency = {
  code: "GBP",
  name: "Pound",
  symbol: "£",
} as Currency

function withPreferences(
  baseCurrencyCode: string | undefined,
): void {
  mockUseUserPreferences.mockReturnValue({
    preferences: baseCurrencyCode ? { baseCurrencyCode } : null,
  } as ReturnType<typeof useUserPreferences>)
}

// Stable empty refs so useFxRates' useEffect deps don't tick every render.
// (The original hook re-runs the effect on every dep ref change, which makes
// passing a literal `[]` to renderHook spin into an infinite loop until the
// fix lands.)
const EMPTY_CURRENCIES: Currency[] = []
const EMPTY_CODES: string[] = []
const CCY_USD: Currency[] = [USD]
const CCY_USD_NZD: Currency[] = [USD, NZD]
const CCY_USD_NZD_GBP: Currency[] = [USD, NZD, GBP]
const CCY_NZD_GBP: Currency[] = [NZD, GBP]
const CODES_NZD: string[] = ["NZD"]
const CODES_NZD_DUP: string[] = ["NZD", "NZD", "NZD"]
const CODES_USD_DUP: string[] = ["USD", "USD"]

describe("useFxRates", () => {
  beforeEach(() => {
    mockUseUserPreferences.mockReset()
    mockFetch.mockReset()
    // Default to "no preferences" so that useUserPreferences() never returns
    // undefined while a renderHook test is in flight (would crash the
    // destructure).
    withPreferences(undefined)
  })

  describe("default display currency selection", () => {
    it("returns null displayCurrency when currencies is empty", () => {
      withPreferences(undefined)

      const { result } = renderHook(() => useFxRates(EMPTY_CURRENCIES, EMPTY_CODES))

      expect(result.current.displayCurrency).toBeNull()
    })

    it("uses preferred baseCurrencyCode when present in currencies", async () => {
      withPreferences("NZD")

      const { result } = renderHook(() => useFxRates(CCY_USD_NZD_GBP, EMPTY_CODES))

      await waitFor(() => {
        expect(result.current.displayCurrency).toEqual(NZD)
      })
    })

    it("falls back to USD when preferred currency is not present", async () => {
      withPreferences("ZZZ")

      const { result } = renderHook(() => useFxRates(CCY_USD_NZD, EMPTY_CODES))

      await waitFor(() => {
        expect(result.current.displayCurrency).toEqual(USD)
      })
    })

    it("falls back to first currency when neither preferred nor USD is present", async () => {
      withPreferences(undefined)

      const { result } = renderHook(() => useFxRates(CCY_NZD_GBP, EMPTY_CODES))

      await waitFor(() => {
        expect(result.current.displayCurrency).toEqual(NZD)
      })
    })

    it("user override via setDisplayCurrency wins over default", async () => {
      withPreferences("USD")

      const { result } = renderHook(() => useFxRates(CCY_USD_NZD_GBP, EMPTY_CODES))

      await waitFor(() => {
        expect(result.current.displayCurrency).toEqual(USD)
      })

      act(() => {
        result.current.setDisplayCurrency(GBP)
      })

      expect(result.current.displayCurrency).toEqual(GBP)
    })
  })

  describe("FX rates fetching", () => {
    it("returns empty rates and ready when no source currencies", async () => {
      withPreferences("USD")

      const { result } = renderHook(() => useFxRates(CCY_USD, EMPTY_CODES))

      await waitFor(() => {
        expect(result.current.fxReady).toBe(true)
      })
      expect(result.current.fxRates).toEqual({})
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("returns unit rates when all source currencies match displayCurrency", async () => {
      withPreferences("USD")

      const { result } = renderHook(() => useFxRates(CCY_USD, CODES_USD_DUP))

      await waitFor(() => {
        expect(result.current.fxReady).toBe(true)
      })
      expect(result.current.fxRates).toEqual({ USD: 1 })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("fetches FX rates for source currencies that differ from displayCurrency", async () => {
      withPreferences("USD")
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { rates: { "NZD:USD": { rate: 0.6 } } },
          }),
      })

      const { result } = renderHook(() => useFxRates(CCY_USD_NZD, CODES_NZD))

      await waitFor(() => {
        expect(result.current.fxReady).toBe(true)
      })
      expect(result.current.fxRates).toEqual({ USD: 1, NZD: 0.6 })
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fx",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            rateDate: "today",
            pairs: [{ from: "NZD", to: "USD" }],
          }),
        }),
      )
    })

    it("deduplicates source currencies before requesting pairs", async () => {
      withPreferences("USD")
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { rates: { "NZD:USD": { rate: 0.6 } } },
          }),
      })

      renderHook(() => useFxRates(CCY_USD_NZD, CODES_NZD_DUP))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.pairs).toEqual([{ from: "NZD", to: "USD" }])
    })
  })
})
