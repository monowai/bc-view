import { act, renderHook, waitFor } from "@testing-library/react"
import useCompositeMonteCarloSimulation from "../useCompositeMonteCarloSimulation"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import type { CompositePhase } from "types/independence"

const phases: CompositePhase[] = [
  { planId: "plan-a", fromAge: 60, toAge: 75 },
  { planId: "plan-b", fromAge: 75 },
]

describe("useCompositeMonteCarloSimulation", () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it("starts with empty state", () => {
    const { result } = renderHook(() => useCompositeMonteCarloSimulation())
    expect(result.current.result).toBeNull()
    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("posts the request body to the composite Monte Carlo endpoint", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: fixtureMonteCarloResult }),
    })

    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 2000,
        phases,
        displayCurrency: "USD",
        seed: 42,
      })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/independence/composite/monte-carlo",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    )
    const call = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(call[1].body)).toEqual({
      displayCurrency: "USD",
      phases,
      iterations: 2000,
      seed: 42,
    })
    expect(result.current.result).toEqual(fixtureMonteCarloResult)
    expect(result.current.error).toBeNull()
    expect(result.current.isRunning).toBe(false)
  })

  it("omits seed when not provided", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: fixtureMonteCarloResult }),
    })

    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 1000,
        phases,
        displayCurrency: "SGD",
      })
    })

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body).not.toHaveProperty("seed")
  })

  it("toggles isRunning around the call", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined
    ;(global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    let runPromise: Promise<void> = Promise.resolve()
    act(() => {
      runPromise = result.current.runSimulation({
        iterations: 500,
        phases,
        displayCurrency: "USD",
      })
    })

    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ data: fixtureMonteCarloResult }),
      })
      await runPromise
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.result).toEqual(fixtureMonteCarloResult)
  })

  it("sets error when the response is not ok", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "boom" }),
    })

    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 1000,
        phases,
        displayCurrency: "USD",
      })
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("boom")
    expect(result.current.result).toBeNull()
  })

  it("sets error when fetch throws", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network"))

    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 1000,
        phases,
        displayCurrency: "USD",
      })
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("network")
  })

  it("does not call fetch when phases array is empty", async () => {
    const { result } = renderHook(() => useCompositeMonteCarloSimulation())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 1000,
        phases: [],
        displayCurrency: "USD",
      })
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
