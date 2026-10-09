/**
 * useNetWorth builds the SWR key for svc-position's /net-worth. The headline
 * comes back computed in the display currency; this hook only decides *when*
 * to ask and *which* portfolios to ask about.
 */
import { renderHook } from "@testing-library/react"
import useSwr from "swr"
import { useNetWorth } from "../useNetWorth"
import { makeNetWorth, makePortfolio, SGD } from "@test-fixtures/beancounter"

jest.mock("swr")

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

function stubSwr(result: Partial<ReturnType<typeof useSwr>> = {}): void {
  mockUseSwr.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
    ...result,
  } as unknown as ReturnType<typeof useSwr>)
}

function swrKey(): string | null {
  return mockUseSwr.mock.calls[0][0] as string | null
}

function idsOf(key: string): string[] {
  const params = new URLSearchParams(key.split("?")[1])
  return (params.get("ids") ?? "").split(",")
}

const portfolios = [
  makePortfolio({ id: "pf-1", code: "ALPHA" }),
  makePortfolio({ id: "pf-2", code: "BETA" }),
]

describe("useNetWorth", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    stubSwr()
  })

  it("asks for today in the display currency", () => {
    renderHook(() => useNetWorth(SGD))
    expect(swrKey()).toBe("/api/net-worth?asAt=today&currency=SGD")
  })

  it("does not fetch until a display currency is known", () => {
    renderHook(() => useNetWorth(null))
    expect(swrKey()).toBeNull()
  })

  it("scopes ids to the portfolios the plan keeps", () => {
    renderHook(() => useNetWorth(SGD, ["pf-1"], portfolios))
    const key = swrKey() as string
    expect(key).toContain("currency=SGD")
    expect(idsOf(key)).toEqual(["pf-2"])
  })

  it("sends every id when nothing is excluded", () => {
    renderHook(() => useNetWorth(SGD, [], portfolios))
    expect(idsOf(swrKey() as string)).toEqual(["pf-1", "pf-2"])
  })

  it("does not fetch when every portfolio is excluded", () => {
    renderHook(() => useNetWorth(SGD, ["pf-1", "pf-2"], portfolios))
    expect(swrKey()).toBeNull()
  })

  it("does not fetch while portfolios are still loading and exclusions apply", () => {
    // An empty included set must never fall through to the unscoped
    // "no ids = all portfolios" default on svc-position.
    renderHook(() => useNetWorth(SGD, ["pf-x"], []))
    expect(swrKey()).toBeNull()
  })

  it("unwraps the payload and reports loading", () => {
    const netWorth = makeNetWorth({ totalValue: 98765 })
    stubSwr({ data: { data: netWorth }, isLoading: false })
    const { result } = renderHook(() => useNetWorth(SGD))
    expect(result.current.netWorth).toEqual(netWorth)
    expect(result.current.isLoading).toBe(false)
  })

  it("is loading while the request is in flight", () => {
    stubSwr({ data: undefined, isLoading: true })
    const { result } = renderHook(() => useNetWorth(SGD))
    expect(result.current.netWorth).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })

  it("exposes the fetch error", () => {
    // A failed request must not read as an empty pot: callers need the
    // error to show something other than a zero headline.
    const error = new Error("svc-position unavailable")
    stubSwr({ data: undefined, isLoading: false, error })
    const { result } = renderHook(() => useNetWorth(SGD))
    expect(result.current.error).toBe(error)
    expect(result.current.netWorth).toBeUndefined()
  })
})
