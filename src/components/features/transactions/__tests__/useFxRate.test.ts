import { renderHook, waitFor } from "@testing-library/react"
import { postFxRates } from "@utils/api/client/fx"
import { useFxRate } from "../useFxRate"

jest.mock("@utils/api/client/fx", () => ({ postFxRates: jest.fn() }))

const respond = (rates: Record<string, { rate: number }>): void => {
  ;(postFxRates as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { rates } }),
  })
}

describe("useFxRate", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns the market rate for the pair", async () => {
    respond({ "USD:NZD": { rate: 1.6 } })
    const { result } = renderHook(() => useFxRate("USD", "NZD"))
    await waitFor(() => expect(result.current.rate).toBe(1.6))
    expect(result.current.loading).toBe(false)
  })

  it("has no rate when the two currencies are the same", () => {
    const { result } = renderHook(() => useFxRate("USD", "USD"))
    expect(result.current.rate).toBeNull()
    expect(postFxRates).not.toHaveBeenCalled()
  })

  it("has no rate when the service fails", async () => {
    ;(postFxRates as jest.Mock).mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useFxRate("USD", "NZD"))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rate).toBeNull()
  })

  it("drops the old rate when the pair changes", async () => {
    respond({ "USD:NZD": { rate: 1.6 } })
    const { result, rerender } = renderHook(
      ({ buy }: { buy: string }) => useFxRate("USD", buy),
      { initialProps: { buy: "NZD" } },
    )
    await waitFor(() => expect(result.current.rate).toBe(1.6))
    rerender({ buy: "USD" })
    expect(result.current.rate).toBeNull()
  })
})
