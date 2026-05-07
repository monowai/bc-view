import { renderHook, waitFor } from "@testing-library/react"
import {
  useDisplayCurrencyConversion,
  useCurrencies,
} from "../useDisplayCurrencyConversion"
import { Currency, Portfolio } from "types/beancounter"

jest.mock("@lib/holdings/holdingState", () => ({
  useHoldingState: jest.fn(),
}))
import { useHoldingState } from "@lib/holdings/holdingState"

const mockUseHoldingState = useHoldingState as jest.MockedFunction<
  typeof useHoldingState
>

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

const portfolio = {
  currency: USD,
  base: NZD,
} as Portfolio

type DisplayMode = "PORTFOLIO" | "BASE" | "TRADE" | "CUSTOM"

function withDisplay(mode: DisplayMode, customCode?: string): void {
  mockUseHoldingState.mockReturnValue({
    displayCurrency: { mode, customCode },
  } as ReturnType<typeof useHoldingState>)
}

describe("useDisplayCurrencyConversion", () => {
  beforeEach(() => {
    mockUseHoldingState.mockReset()
    mockFetch.mockReset()
  })

  it("PORTFOLIO mode returns portfolio.currency, sync rate of 1", () => {
    withDisplay("PORTFOLIO")

    const { result } = renderHook(() =>
      useDisplayCurrencyConversion({ sourceCurrency: USD, portfolio }),
    )

    expect(result.current.currencyCode).toBe("USD")
    expect(result.current.currencySymbol).toBe("$")
    expect(result.current.convert(100)).toBe(100)
    expect(result.current.isCustomCurrency).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("BASE mode returns portfolio.base", async () => {
    withDisplay("BASE")

    const { result } = renderHook(() =>
      // sourceCurrency NZD = portfolio.base NZD → sync rate of 1
      useDisplayCurrencyConversion({ sourceCurrency: NZD, portfolio }),
    )

    expect(result.current.currencyCode).toBe("NZD")
    await waitFor(() => {
      expect(result.current.convert(100)).toBe(100)
    })
  })

  it("TRADE mode returns sourceCurrency", () => {
    withDisplay("TRADE")

    const { result } = renderHook(() =>
      useDisplayCurrencyConversion({ sourceCurrency: GBP, portfolio }),
    )

    expect(result.current.currencyCode).toBe("GBP")
    expect(result.current.currencySymbol).toBe("£")
    expect(result.current.convert(100)).toBe(100)
  })

  it("falls back to sourceCurrency when sourceCurrency is undefined", () => {
    withDisplay("TRADE")

    const { result } = renderHook(() =>
      useDisplayCurrencyConversion({ sourceCurrency: undefined, portfolio }),
    )

    expect(result.current.currencyCode).toBe("")
    expect(result.current.currencySymbol).toBe("$")
  })

  it("fetches FX rate when source and target currencies differ", async () => {
    withDisplay("PORTFOLIO") // target = portfolio.currency = USD; source = NZD
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { rates: { "NZD:USD": { rate: 0.6 } } },
        }),
    })

    const { result } = renderHook(() =>
      useDisplayCurrencyConversion({ sourceCurrency: NZD, portfolio }),
    )

    await waitFor(() => {
      expect(result.current.convert(100)).toBeCloseTo(60, 5)
    })
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/fx",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("CUSTOM mode fetches currencies list and uses matching code", async () => {
    withDisplay("CUSTOM", "GBP")
    // Currencies fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [USD, NZD, GBP] }),
    })
    // FX fetch (USD → GBP)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { rates: { "USD:GBP": { rate: 0.79 } } },
        }),
    })

    const { result } = renderHook(() =>
      useDisplayCurrencyConversion({ sourceCurrency: USD, portfolio }),
    )

    await waitFor(() => {
      expect(result.current.currencyCode).toBe("GBP")
    })
    expect(result.current.isCustomCurrency).toBe(true)
  })
})

// useCurrencies has a module-scoped cache so it's stateful across tests; the
// assertion below targets only post-fetch state (the cache will already be
// populated from earlier tests in this file in many cases — that's fine, the
// hook should still return the populated list and report isLoading false).
describe("useCurrencies", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // If cache is empty, this fetch satisfies the first call. If cache is
    // populated from an earlier test, the hook short-circuits and this is
    // unused.
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [USD, NZD] }),
    })
  })

  it("eventually exposes a non-empty currency list and isLoading=false", async () => {
    const { result } = renderHook(() => useCurrencies())

    await waitFor(() => {
      expect(result.current.currencies.length).toBeGreaterThan(0)
      expect(result.current.isLoading).toBe(false)
    })
  })
})
