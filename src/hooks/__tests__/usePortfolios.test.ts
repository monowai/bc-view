import { renderHook, act } from "@testing-library/react"
import { usePortfolios } from "../usePortfolios"
import useSwr from "swr"
import { useFxRates } from "../useFxRates"
import { Currency, Portfolio } from "types/beancounter"

jest.mock("swr")
jest.mock("../useFxRates")

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>
const mockUseFxRates = useFxRates as jest.MockedFunction<typeof useFxRates>

const makeCurrency = (code: string): Currency => ({
  code,
  name: code,
  symbol: "$",
})

const makePortfolio = (code: string, currencyCode: string): Portfolio => ({
  id: code,
  code,
  name: code,
  currency: makeCurrency(currencyCode),
  base: makeCurrency(currencyCode),
  marketValue: 10000,
  irr: 0.05,
})

describe("usePortfolios", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseFxRates.mockReset()
    global.fetch = jest.fn()

    // Default: currencies fetch returns empty
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })

    mockUseFxRates.mockReturnValue({
      displayCurrency: null,
      setDisplayCurrency: jest.fn(),
      fxRates: {},
      fxReady: false,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns loading state initially", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: undefined,
      isLoading: true,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => usePortfolios())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.portfolios).toEqual([])
  })

  it("returns portfolios from SWR", () => {
    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "NZD")]
    mockUseSwr.mockReturnValue({
      data: { data: portfolios },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    mockUseFxRates.mockReturnValue({
      displayCurrency: makeCurrency("USD"),
      setDisplayCurrency: jest.fn(),
      fxRates: { USD: 1, NZD: 0.6 },
      fxReady: true,
    })

    const { result } = renderHook(() => usePortfolios())

    expect(result.current.portfolios).toEqual(portfolios)
    expect(result.current.fxRatesReady).toBe(true)
  })

  it("returns error from SWR", () => {
    const err = new Error("Network failure")
    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: err,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => usePortfolios())

    expect(result.current.error).toBe(err)
  })

  it("fetches currencies on mount", () => {
    const currencies = [makeCurrency("USD"), makeCurrency("NZD")]
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: currencies }),
    })

    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: undefined,
      isLoading: true,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    renderHook(() => usePortfolios())

    expect(global.fetch).toHaveBeenCalledWith("/api/currencies")
  })

  it("computes sourceCurrencyCodes from portfolios", () => {
    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "NZD")]
    mockUseSwr.mockReturnValue({
      data: { data: portfolios },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    renderHook(() => usePortfolios())

    expect(mockUseFxRates).toHaveBeenCalledWith(expect.any(Array), [
      "USD",
      "NZD",
    ])
  })

  it("deletePortfolio calls API and mutates", async () => {
    const mutateFn = jest.fn()
    mockUseSwr.mockReturnValue({
      data: { data: [makePortfolio("P1", "USD")] },
      mutate: mutateFn,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/portfolios/")) {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    })

    const { result } = renderHook(() => usePortfolios())

    await act(async () => {
      await result.current.deletePortfolio("P1")
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/portfolios/P1", {
      method: "DELETE",
    })
    expect(mutateFn).toHaveBeenCalled()
  })

  it("passes fxRates through from useFxRates", () => {
    mockUseSwr.mockReturnValue({
      data: { data: [] },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const setDisplayCurrency = jest.fn()
    mockUseFxRates.mockReturnValue({
      displayCurrency: makeCurrency("USD"),
      setDisplayCurrency,
      fxRates: { USD: 1 },
      fxReady: true,
    })

    const { result } = renderHook(() => usePortfolios())

    expect(result.current.displayCurrency).toEqual(makeCurrency("USD"))
    expect(result.current.fxRates).toEqual({ USD: 1 })
    expect(result.current.setDisplayCurrency).toBe(setDisplayCurrency)
  })
})
