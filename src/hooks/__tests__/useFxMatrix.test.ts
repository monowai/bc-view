import { renderHook } from "@testing-library/react"
import { useFxMatrix } from "../useFxMatrix"
import useSwr from "swr"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

describe("useFxMatrix", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("returns loading state when currencies are loading", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxMatrix(undefined, false))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.currencies).toEqual([])
  })

  it("returns currencies and rates", () => {
    const currencies = [
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "NZD", name: "NZ Dollar", symbol: "$" },
    ]
    const rates = {
      "USD:NZD": { rate: 1.5, date: "2025-01-01" },
      "NZD:USD": { rate: 0.667, date: "2025-01-01" },
    }

    // Calls: ccyKey, providers, fxKey, fxResponse1, fxResponse2
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: currencies },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: { providers: ["FRANKFURTER"] },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: { data: { rates } },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxMatrix(undefined, false))

    expect(result.current.currencies).toEqual(currencies)
    expect(result.current.rates).toEqual(rates)
    expect(result.current.providers).toEqual(["FRANKFURTER"])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.rateDates.rateDate).toBe("2025-01-01")
  })

  it("returns error from currency fetch", () => {
    const err = new Error("Currency fetch failed")
    mockUseSwr
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: err,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxMatrix(undefined, false))

    expect(result.current.error).toBe(err)
  })

  it("returns empty compare rates when not in compare mode", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxMatrix(undefined, false))

    expect(result.current.compareRates1).toEqual({})
    expect(result.current.compareRates2).toEqual({})
  })
})
