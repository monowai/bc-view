import { renderHook, act } from "@testing-library/react"
import { useFxHistory } from "../useFxHistory"
import useSwr from "swr"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

describe("useFxHistory", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("returns loading state initially", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.chartData).toEqual([])
    expect(result.current.stats).toBeNull()
  })

  it("returns chart data and computes stats", () => {
    const historyData = [
      { date: "2025-01-01", rate: 1.5 },
      { date: "2025-02-01", rate: 1.6 },
      { date: "2025-03-01", rate: 1.55 },
    ]
    mockUseSwr.mockReturnValue({
      data: { data: historyData },
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    expect(result.current.chartData).toEqual(historyData)
    expect(result.current.stats).toEqual({
      min: 1.5,
      max: 1.6,
      current: 1.55,
      change: expect.closeTo(0.05, 10),
      changePercent: expect.closeTo(3.333, 2),
    })
  })

  it("defaults to 3 months and not inverted", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    expect(result.current.months).toBe(3)
    expect(result.current.isInverted).toBe(false)
  })

  it("constructs correct SWR key", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    renderHook(() => useFxHistory("USD", "NZD"))

    expect(mockUseSwr).toHaveBeenCalledWith(
      "/api/fx/history?from=USD&to=NZD&months=3",
      expect.any(Function),
    )
  })

  it("swaps currencies when inverted", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    act(() => {
      result.current.setIsInverted(true)
    })

    expect(mockUseSwr).toHaveBeenCalledWith(
      "/api/fx/history?from=NZD&to=USD&months=3",
      expect.any(Function),
    )
  })

  it("updates months", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    act(() => {
      result.current.setMonths(12)
    })

    expect(result.current.months).toBe(12)
  })

  it("returns error from SWR", () => {
    const err = new Error("Network failure")
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: err,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useFxHistory("USD", "NZD"))

    expect(result.current.error).toBe(err)
  })
})
