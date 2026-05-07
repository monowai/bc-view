import { renderHook, waitFor } from "@testing-library/react"
import useSwr from "swr"
import { usePlan } from "../usePlan"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const mockFetch = jest.fn()
global.fetch = mockFetch

const baseSwr = {
  isLoading: false,
  isValidating: false,
  error: undefined,
  mutate: jest.fn(),
}

function swrResult<T>(data: T | undefined): ReturnType<typeof useSwr> {
  return { ...baseSwr, data } as unknown as ReturnType<typeof useSwr>
}

describe("usePlan", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockFetch.mockReset()
  })

  it("does not call SWR when planId is undefined", () => {
    mockUseSwr.mockReturnValue(swrResult(undefined))

    renderHook(() => usePlan(undefined))

    // SWR is called, but with a null key — that signals "don't fetch"
    expect(mockUseSwr).toHaveBeenCalledWith(null, null)
  })

  it("constructs the SWR key from planId", () => {
    mockUseSwr.mockReturnValue(swrResult(undefined))

    renderHook(() => usePlan("plan-123"))

    expect(mockUseSwr.mock.calls[0][0]).toContain("plan-123")
  })

  it("returns plan as-is when there is no items array", () => {
    const plan = { id: "p1", status: "DRAFT" }
    mockUseSwr.mockReturnValue(swrResult({ data: plan }))

    const { result } = renderHook(() => usePlan("p1"))

    return waitFor(() => {
      expect(result.current.plan).toEqual(plan)
    })
  })

  it("returns items unchanged when already enriched", async () => {
    const items = [
      {
        assetId: "a1",
        assetCode: "AAPL",
        assetName: "Apple Inc",
      },
    ]
    const plan = { id: "p2", items }
    mockUseSwr.mockReturnValue(swrResult({ data: plan }))

    const { result } = renderHook(() => usePlan("p2"))

    await waitFor(() => {
      expect(result.current.plan?.items).toEqual(items)
    })
    // No fetch needed for asset details since items are already enriched
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("fetches and merges asset details for unenriched items", async () => {
    const items = [{ assetId: "a2" }]
    const plan = { id: "p3", items }
    mockUseSwr.mockReturnValue(swrResult({ data: plan }))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ data: { code: "MSFT", name: "Microsoft" } }),
    })

    const { result } = renderHook(() => usePlan("p3"))

    await waitFor(() => {
      expect(result.current.plan?.items?.[0]).toMatchObject({
        assetId: "a2",
        assetCode: "MSFT",
        assetName: "Microsoft",
      })
    })
    expect(mockFetch).toHaveBeenCalledWith("/api/assets/a2")
  })

  it("propagates SWR error", () => {
    const error = new Error("network down")
    mockUseSwr.mockReturnValue({
      ...baseSwr,
      data: undefined,
      error,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => usePlan("p4"))

    expect(result.current.error).toBe(error)
  })

  it("forwards SWR isLoading", () => {
    mockUseSwr.mockReturnValue({
      ...baseSwr,
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => usePlan("p5"))

    expect(result.current.isLoading).toBe(true)
  })

  it("forwards SWR mutate", () => {
    const mutate = jest.fn()
    mockUseSwr.mockReturnValue({
      ...baseSwr,
      data: undefined,
      mutate,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => usePlan("p6"))

    expect(result.current.mutate).toBe(mutate)
  })
})
