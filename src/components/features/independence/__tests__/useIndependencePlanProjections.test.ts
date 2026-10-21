import { renderHook, waitFor } from "@testing-library/react"
import { useIndependencePlanProjections } from "../useIndependencePlanProjections"

// Stable empty array reference to avoid infinite re-render loop in useEffect
const EMPTY_ASSETS: never[] = []

describe("useIndependencePlanProjections", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns empty projections when no lump sum assets", () => {
    const { result } = renderHook(() =>
      useIndependencePlanProjections(EMPTY_ASSETS, undefined, "NZD"),
    )

    expect(result.current.pensionProjections).toEqual([])
  })

  it("returns empty projections when currentAge is undefined", () => {
    const lumpSumAssets = [
      {
        config: {
          assetId: "a1",
          isPension: true,
          lumpSum: true,
          payoutAge: 65,
          expectedReturnRate: 0.05,
          monthlyContribution: 500,
          rentalCurrency: undefined,
        },
        assetName: "Pension Fund",
        currentValue: 100000,
        category: "Policy",
      },
    ]

    const { result } = renderHook(() =>
      useIndependencePlanProjections(lumpSumAssets, undefined, "NZD"),
    )

    expect(result.current.pensionProjections).toEqual([])
  })

  it("fetches FV projections for lump sum assets", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { projectedPayout: 150000 } }),
    })

    const lumpSumAssets = [
      {
        config: {
          assetId: "a1",
          isPension: true,
          lumpSum: true,
          payoutAge: 65,
          expectedReturnRate: 0.05,
          monthlyContribution: 500,
          rentalCurrency: undefined,
        },
        assetName: "Pension Fund",
        currentValue: 100000,
        category: "Policy",
      },
    ]

    const { result } = renderHook(() =>
      useIndependencePlanProjections(lumpSumAssets, 40, "NZD"),
    )

    await waitFor(() => {
      expect(result.current.pensionProjections.length).toBe(1)
    })

    const proj = result.current.pensionProjections[0]
    expect(proj.assetId).toBe("a1")
    expect(proj.assetName).toBe("Pension Fund")
    expect(proj.currentValue).toBe(100000)
    // projectedValue = grownCurrentValue + contributionFV
    // grownCurrentValue = 100000 * (1.05)^25 = ~338635
    // contributionFV = 150000
    expect(proj.projectedValue).toBeGreaterThan(100000)
    expect(proj.payoutAge).toBe(65)
  })

  it("handles already-past-payout-age assets", async () => {
    const lumpSumAssets = [
      {
        config: {
          assetId: "a2",
          isPension: true,
          lumpSum: true,
          payoutAge: 60,
          expectedReturnRate: 0.05,
          monthlyContribution: 0,
          rentalCurrency: "NZD",
        },
        assetName: "Matured Policy",
        currentValue: 200000,
        category: "Policy",
      },
    ]

    const { result } = renderHook(() =>
      useIndependencePlanProjections(lumpSumAssets, 65, "NZD"),
    )

    await waitFor(() => {
      expect(result.current.pensionProjections.length).toBe(1)
    })

    // currentAge >= payoutAge, so projectedValue = currentValue
    expect(result.current.pensionProjections[0].projectedValue).toBe(200000)
    // Should NOT have called fetch
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("skips assets missing payoutAge or expectedReturnRate", async () => {
    const lumpSumAssets = [
      {
        config: {
          assetId: "a3",
          isPension: true,
          lumpSum: true,
          payoutAge: undefined,
          expectedReturnRate: undefined,
          monthlyContribution: 0,
          rentalCurrency: undefined,
        },
        assetName: "Incomplete Config",
        currentValue: 50000,
        category: "Policy",
      },
    ]

    const { result } = renderHook(() =>
      useIndependencePlanProjections(lumpSumAssets, 40, "NZD"),
    )

    await waitFor(() => {
      expect(result.current.pensionProjections).toEqual([])
    })
  })
})
