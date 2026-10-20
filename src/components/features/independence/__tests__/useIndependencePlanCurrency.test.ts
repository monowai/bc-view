import { renderHook, act, waitFor } from "@testing-library/react"
import { useIndependencePlanCurrency } from "../useIndependencePlanCurrency"

describe("useIndependencePlanCurrency", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns plan currency when no display currency set", () => {
    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    expect(result.current.displayCurrency).toBeNull()
    expect(result.current.effectiveCurrency).toBe("NZD")
    expect(result.current.effectiveFxRate).toBe(1)
  })

  it("fetches FX rate when display currency changes", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { rates: { "NZD:USD": { rate: 0.62 } } },
        }),
    })

    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    await waitFor(() => {
      expect(result.current.fxRateLoaded).toBe(true)
    })

    expect(result.current.effectiveCurrency).toBe("USD")
    expect(result.current.effectiveFxRate).toBe(0.62)
  })

  it("stays in plan currency when same currency selected", async () => {
    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    act(() => {
      result.current.setDisplayCurrency("NZD")
    })

    await waitFor(() => {
      expect(result.current.fxRateLoaded).toBe(true)
    })

    expect(result.current.effectiveFxRate).toBe(1)
  })

  it("falls back to plan currency when FX rate fetch fails", async () => {
    // The hook logs the underlying error via console.error before falling
    // back. That's expected runtime behaviour, but it pollutes test output,
    // so silence it for this case only.
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {})

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Should fall back to plan currency
    expect(result.current.effectiveCurrency).toBe("NZD")
    expect(result.current.effectiveFxRate).toBe(1)

    // Sanity-check the fallback was triggered by a logged failure.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to fetch FX rate:",
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  // A rate that is present but unusable is the same outcome as a missing one:
  // multiplying by it would render a confident, wrong figure (S$6,890 → "≈ NZ$0")
  // rather than simply not offering the conversion.
  it.each([
    ["zero", 0],
    ["negative", -1.4],
    ["null", null],
  ])("falls back when the response carries a %s rate", async (_label, rate) => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { rates: { "NZD:USD": { rate } } },
        }),
    })

    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    // Async act so the fetch settles before we assert — mid-flight the hook
    // is legitimately un-loaded, which would let this pass for the wrong reason.
    await act(async () => {
      result.current.setDisplayCurrency("USD")
      await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalled()
    expect(result.current.fxRateLoaded).toBe(false)
    expect(result.current.effectiveCurrency).toBe("NZD")
    expect(result.current.effectiveFxRate).toBe(1)
    expect(result.current.fxRate).toBe(1)
  })

  it("falls back when rate not found in response", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { rates: {} } }),
    })

    const { result } = renderHook(() => useIndependencePlanCurrency("NZD"))

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(result.current.effectiveCurrency).toBe("NZD")
  })
})
