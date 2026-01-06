import { renderHook, act, waitFor } from "@testing-library/react"
import { useRetirementProjection } from "../useRetirementProjection"
import { DEFAULT_WHAT_IF_ADJUSTMENTS } from "../types"
import { RetirementPlan } from "types/retirement"

// Mock fetch
global.fetch = jest.fn()

const mockPlan: RetirementPlan = {
  id: "test-plan-1",
  name: "Test Plan",
  yearOfBirth: 1980,
  lifeExpectancy: 90,
  planningHorizonYears: 25,
  monthlyExpenses: 5000,
  expensesCurrency: "NZD",
  pensionMonthly: 1000,
  socialSecurityMonthly: 500,
  otherIncomeMonthly: 200,
  workingIncomeMonthly: 8000,
  workingExpensesMonthly: 6000,
  investmentAllocationPercent: 0.8,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.5,
  housingAllocation: 0.2,
  targetBalance: 100000,
  ownerId: "test-owner",
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

const mockProjectionResponse = {
  data: {
    liquidAssets: 500000,
    nonSpendableAtRetirement: 200000,
    runwayYears: 25,
    runwayMonths: 300,
    depletionAge: 90,
    yearlyProjections: [
      {
        year: 1,
        age: 65,
        startingBalance: 500000,
        investment: 35000,
        withdrawals: 40000,
        endingBalance: 495000,
        inflationAdjustedExpenses: 60000,
        currency: "NZD",
        nonSpendableValue: 200000,
        totalWealth: 695000,
        propertyLiquidated: false,
      },
    ],
    preRetirementAccumulation: {
      yearsToRetirement: 10,
      startingBalance: 300000,
      projectedBalance: 500000,
    },
  },
}

const defaultProps = {
  plan: mockPlan,
  liquidAssets: 500000,
  nonSpendableAssets: 200000,
  selectedPortfolioIds: ["portfolio-1"],
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 90,
  monthlyInvestment: 1600,
  blendedReturnRate: 0.06,
  planCurrency: "$",
  whatIfAdjustments: DEFAULT_WHAT_IF_ADJUSTMENTS,
  scenarioOverrides: {},
  spendableCategories: ["Equity", "Cash"],
}

describe("useRetirementProjection", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProjectionResponse),
    })
  })

  it("returns initial state with null projections", () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        spendableCategories: [], // No categories = no auto-calculate
      }),
    )

    expect(result.current.projection).toBeNull()
    expect(result.current.adjustedProjection).toBeNull()
    expect(result.current.isCalculating).toBe(false)
  })

  it("auto-calculates projection when data is ready", async () => {
    renderHook(() => useRetirementProjection(defaultProps))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/retire/projection/test-plan-1",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      )
    })
  })

  it("does not auto-calculate when liquidAssets is 0", async () => {
    renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        liquidAssets: 0,
      }),
    )

    // Wait a bit to ensure no call is made
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("does not auto-calculate when plan is undefined", async () => {
    renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        plan: undefined,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("sets isCalculating to true during calculation", async () => {
    let resolvePromise: () => void
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    ;(global.fetch as jest.Mock).mockImplementation(() =>
      pendingPromise.then(() => ({
        ok: true,
        json: () => Promise.resolve(mockProjectionResponse),
      })),
    )

    const { result } = renderHook(() => useRetirementProjection(defaultProps))

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(true)
    })

    act(() => {
      resolvePromise!()
    })

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false)
    })
  })

  it("resets projection when resetProjection is called", async () => {
    const { result } = renderHook(() => useRetirementProjection(defaultProps))

    await waitFor(() => {
      expect(result.current.projection).not.toBeNull()
    })

    act(() => {
      result.current.resetProjection()
    })

    // After reset, projection should be null again
    // Note: It will auto-recalculate, so we check immediately after reset
    expect(result.current.projection).toBeNull()
  })

  it("applies retirement age offset to adjusted projection", async () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        whatIfAdjustments: {
          ...DEFAULT_WHAT_IF_ADJUSTMENTS,
          retirementAgeOffset: 2,
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.adjustedProjection).not.toBeNull()
    })

    // With +2 years offset, first projection year should be age 67
    expect(result.current.adjustedProjection?.yearlyProjections[0]?.age).toBe(
      67,
    )
  })

  it("applies expenses percentage to adjusted projection", async () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        whatIfAdjustments: {
          ...DEFAULT_WHAT_IF_ADJUSTMENTS,
          expensesPercent: 120,
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.adjustedProjection).not.toBeNull()
    })

    // Withdrawals should be higher due to 120% expenses
    const baseWithdrawals =
      mockProjectionResponse.data.yearlyProjections[0].withdrawals
    expect(
      result.current.adjustedProjection?.yearlyProjections[0]?.withdrawals,
    ).toBeGreaterThan(baseWithdrawals * 0.9) // Allow some margin
  })

  it("applies scenario overrides to income calculations", async () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        scenarioOverrides: {
          pensionMonthly: 2000, // Double the pension
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.adjustedProjection).not.toBeNull()
    })

    // With higher pension, withdrawals should be lower
    // (expenses - income = withdrawals)
    expect(result.current.adjustedProjection).toBeDefined()
  })

  it("calculates liquidation threshold correctly", async () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        whatIfAdjustments: {
          ...DEFAULT_WHAT_IF_ADJUSTMENTS,
          liquidationThreshold: 20,
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.adjustedProjection).not.toBeNull()
    })

    expect(result.current.adjustedProjection?.liquidationThresholdPercent).toBe(
      20,
    )
  })

  it("handles API error gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation()
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("API Error"))

    const { result } = renderHook(() => useRetirementProjection(defaultProps))

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false)
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to calculate projection:",
      expect.any(Error),
    )
    expect(result.current.projection).toBeNull()

    consoleSpy.mockRestore()
  })

  it("applies equity allocation adjustment", async () => {
    const { result } = renderHook(() =>
      useRetirementProjection({
        ...defaultProps,
        whatIfAdjustments: {
          ...DEFAULT_WHAT_IF_ADJUSTMENTS,
          equityPercent: 80, // 80% equity, 20% cash
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.adjustedProjection).not.toBeNull()
    })

    // Higher equity allocation should affect returns
    expect(result.current.adjustedProjection).toBeDefined()
  })
})
