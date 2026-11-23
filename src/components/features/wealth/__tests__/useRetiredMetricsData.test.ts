import { renderHook } from "@testing-library/react"
import { DASHBOARD_SEED, useRetiredMetricsData } from "../useRetiredMetricsData"
import type {
  CompositeYearlyProjection,
  RetirementProjection,
} from "types/independence"
import {
  journeyRetiredBasis,
  phaseRetiredBasis,
} from "@lib/independence/retiredBasis"
import {
  compositeMonteCarloUrl,
  monteCarloUrl,
} from "@utils/api/client/independence"
import {
  makeCompositeProjection,
  makeJourney,
} from "@test-fixtures/independence"

// Net invested per window, keyed by the days parameter in the SWR key.
const invested: Record<string, number> = {}
// Recorded spend and plan expenses, served for their keys when set.
let spendRows: unknown[] | undefined
let expenseRows: unknown[] | undefined
let spendError: Error | undefined
let spendLoading = false
let monteCarloError: Error | undefined
// Budget rows per phase plan id, for tests that tell the phases apart.
let expenseRowsByPlan: Record<string, unknown[]> | undefined
// The simulation's SWR key and fetcher, so a test can run the request.
let simulation:
  { key: unknown; fetcher: (key: unknown) => Promise<unknown> } | undefined

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: unknown, fetcher: (key: unknown) => Promise<unknown>) => {
    if (typeof key === "string" && key.includes("/spend")) {
      return {
        data: spendRows && { data: spendRows },
        error: spendError,
        isLoading: spendLoading,
        mutate: jest.fn(),
      }
    }
    if (typeof key === "string" && key.endsWith("/expenses")) {
      const planId = key.split("/").slice(-2)[0]
      const rows = expenseRowsByPlan ? expenseRowsByPlan[planId] : expenseRows
      return { data: rows && { data: rows } }
    }
    if (typeof key === "string") {
      const days = /days=(\d+)/.exec(key)?.[1] ?? ""
      return days in invested
        ? { data: { totalInvested: invested[days] }, isLoading: false }
        : { data: undefined, isLoading: true }
    }
    simulation = { key, fetcher }
    return monteCarloError
      ? { data: undefined, isLoading: false, error: monteCarloError }
      : { data: undefined, isLoading: true }
  },
}))

const projection = {
  planId: "p1",
  currency: "NZD",
  totalAssets: 1_200_000,
  liquidAssets: 1_000_000,
  monthlyExpenses: 3_000,
  yearlyProjections: [{ year: 2026, withdrawals: 36_000 }],
} as unknown as RetirementProjection

const thisMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

describe("useRetiredMetricsData", () => {
  afterEach(() => {
    for (const k of Object.keys(invested)) delete invested[k]
    spendRows = undefined
    expenseRows = undefined
    spendError = undefined
    spendLoading = false
    monteCarloError = undefined
    expenseRowsByPlan = undefined
    simulation = undefined
  })

  it("reports the spend log unavailable when it fails to load", () => {
    spendError = new Error("HTTP 500")
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.spendUnavailable).toBe(true)
    expect(result.current.spend).toBeNull()
  })

  it("sets recorded spend against the plan's retirement budget", () => {
    expenseRows = [
      {
        categoryLabelId: "housing",
        monthlyAmount: 2_000,
        expensePhase: "RETIREMENT",
      },
      {
        categoryLabelId: "travel",
        monthlyAmount: 1_500,
        expensePhase: "RETIREMENT",
      },
      {
        categoryLabelId: "commute",
        monthlyAmount: 400,
        expensePhase: "WORKING",
      },
    ]
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_500,
        currency: "NZD",
      },
      {
        month: thisMonth(),
        categoryLabelId: "travel",
        actual: 1_500,
        currency: "NZD",
      },
    ]
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.spend).toMatchObject({
      monthsEntered: 1,
      actual: 4_000,
      budget: 3_500,
    })
  })

  it("loads two years of history and summarises the last twelve months", () => {
    const d = new Date()
    const yearAgo = `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}`
    spendRows = [
      {
        month: yearAgo,
        categoryLabelId: "housing",
        actual: 9_999,
        currency: "NZD",
      },
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_000,
        currency: "NZD",
      },
    ]
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    // A year ago is in the history but outside the 12-month summary.
    expect(result.current.spend).toMatchObject({
      monthsEntered: 1,
      actual: 2_000,
    })
  })

  it("leaves spend logged in another currency out of the plan comparison", () => {
    expenseRows = [
      {
        categoryLabelId: "housing",
        monthlyAmount: 2_000,
        expensePhase: "RETIREMENT",
      },
    ]
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_500,
        currency: "SGD",
      },
    ]
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.spend).toBeNull()
    expect(result.current.spendOtherCurrency).toBe("SGD")
  })

  it("has no other currency when spend is logged in the plan's", () => {
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_000,
        currency: "NZD",
      },
    ]
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.spendOtherCurrency).toBeNull()
  })

  it("has no spend summary before any spend is recorded", () => {
    spendRows = []
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.spend).toBeNull()
  })

  it("counts net selling from investments as money drawn", () => {
    invested["30"] = -3_500
    invested["365"] = -44_000
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.drawnLastMonth).toBe(3_500)
    expect(result.current.drawnLastYear).toBe(44_000)
  })

  it("counts net buying as nothing drawn", () => {
    invested["30"] = 2_000
    invested["365"] = 10_000
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.drawnLastMonth).toBe(0)
    expect(result.current.drawnLastYear).toBe(0)
  })

  it("withholds investment sales until the spend log has loaded", () => {
    invested["30"] = -3_500
    invested["365"] = -44_000
    spendLoading = true
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.drawnLastMonth).toBeUndefined()
    expect(result.current.drawnLastYear).toBeUndefined()
  })

  it("leaves the draw unknown until the windows load", () => {
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.drawnLastYear).toBeUndefined()
    expect(result.current.monteCarloLoading).toBe(true)
    expect(result.current.monteCarloUnavailable).toBe(false)
  })

  it("reports the simulation unavailable when it fails", () => {
    monteCarloError = new Error("Failed to run Monte Carlo simulation")
    const { result } = renderHook(() =>
      useRetiredMetricsData(phaseRetiredBasis(projection)),
    )
    expect(result.current.monteCarloUnavailable).toBe(true)
  })
})

describe("useRetiredMetricsData — journey basis", () => {
  const phases = [
    { planId: "plan-go", fromAge: 60, toAge: 75 },
    { planId: "plan-slow", fromAge: 75 },
  ]
  const journey = makeJourney({
    id: "jrn-1",
    displayCurrency: "NZD",
    workScenarioId: "ws-1",
    phases: JSON.stringify(phases),
  })
  const row = (age: number, planId: string): CompositeYearlyProjection =>
    ({
      year: 2026 + (age - 76),
      age,
      planId,
      planName: planId,
    }) as CompositeYearlyProjection
  // Aged 76: past the first phase and into the second.
  const composite = makeCompositeProjection({
    displayCurrency: "NZD",
    totalAssets: 2_500_000,
    liquidAssets: 2_000_000,
    currentAge: 76,
    retirementAge: 60,
    plannedAnnualDraw: 50_000,
    yearlyProjections: [row(76, "plan-slow"), row(77, "plan-slow")],
  })
  const basis = journeyRetiredBasis(journey, composite, 95)

  const housing = (monthlyAmount: number): unknown => ({
    categoryLabelId: "housing",
    monthlyAmount,
    expensePhase: "RETIREMENT",
  })

  afterEach(() => {
    expenseRowsByPlan = undefined
    spendRows = undefined
    simulation = undefined
    ;(global.fetch as jest.Mock).mockClear()
  })

  it("simulates the whole journey, not one phase", async () => {
    const simulated = { successRate: 91, yearlyBands: [] }
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: simulated }),
    })
    renderHook(() => useRetiredMetricsData(basis))

    expect(simulation).toBeDefined()
    await expect(simulation?.fetcher(simulation.key)).resolves.toEqual(
      simulated,
    )

    const calls = (global.fetch as jest.Mock).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(compositeMonteCarloUrl)
    expect(JSON.parse(calls[0][1].body)).toEqual({
      displayCurrency: "NZD",
      phases,
      workScenarioId: "ws-1",
      seed: DASHBOARD_SEED,
    })
    expect(calls.map((call) => call[0])).not.toContain(monteCarloUrl("plan-go"))
  })

  it("keys the simulation on the journey and its phases", () => {
    renderHook(() => useRetiredMetricsData(basis))
    expect(simulation?.key).toEqual(
      expect.arrayContaining([
        compositeMonteCarloUrl,
        "jrn-1",
        journey.phases,
        "NZD",
      ]),
    )
  })

  it("budgets from the phase the owner is in now", () => {
    expenseRowsByPlan = {
      "plan-go": [housing(9_000)],
      "plan-slow": [housing(2_000)],
    }
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_500,
        currency: "NZD",
      },
    ]
    const { result } = renderHook(() => useRetiredMetricsData(basis))
    expect(result.current.spend).toMatchObject({
      actual: 2_500,
      budget: 2_000,
    })
  })

  it("budgets from the first phase when no row carries the owner's age", () => {
    expenseRowsByPlan = {
      "plan-go": [housing(9_000)],
      "plan-slow": [housing(2_000)],
    }
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        actual: 2_500,
        currency: "NZD",
      },
    ]
    const noRows = journeyRetiredBasis(
      journey,
      { ...composite, yearlyProjections: [] },
      95,
    )
    const { result } = renderHook(() => useRetiredMetricsData(noRows))
    expect(result.current.spend).toMatchObject({ budget: 9_000 })
  })
})

describe("retired basis adapters", () => {
  it("reads a phase projection as the tiles always have", () => {
    const basis = phaseRetiredBasis({
      ...projection,
      yearlyProjections: [
        { year: 2026, age: 65, withdrawals: 30_000 },
        { year: 2027, age: 66, withdrawals: 36_000 },
      ],
      planInputs: { currentAge: 66, retirementAge: 65, lifeExpectancy: 95 },
    } as unknown as RetirementProjection)
    expect(basis).toMatchObject({
      currency: "NZD",
      liquidAssets: 1_000_000,
      plannedAnnualDraw: 36_000,
      lifeExpectancy: 95,
      budgetPlanId: "p1",
    })
  })

  it("simulates a phase on the assets its projection used", async () => {
    ;(global.fetch as jest.Mock).mockClear()
    await phaseRetiredBasis(projection).runMonteCarlo(DASHBOARD_SEED)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(monteCarloUrl("p1"))
    expect(JSON.parse(init.body)).toEqual({
      currency: "NZD",
      liquidAssets: 1_000_000,
      nonSpendableAssets: 200_000,
      seed: DASHBOARD_SEED,
    })
  })

  it("takes a journey's figures from the backend, never from its rows", () => {
    const basis = journeyRetiredBasis(
      makeJourney({
        id: "jrn-1",
        phases: JSON.stringify([{ planId: "plan-go", fromAge: 60 }]),
      }),
      makeCompositeProjection({
        displayCurrency: "SGD",
        liquidAssets: 2_000_000,
        plannedAnnualDraw: 50_000,
      }),
      92,
    )
    expect(basis).toMatchObject({
      currency: "SGD",
      liquidAssets: 2_000_000,
      plannedAnnualDraw: 50_000,
      lifeExpectancy: 92,
      budgetPlanId: "plan-go",
    })
  })

  it("plans no draw when the backend sent none", () => {
    const basis = journeyRetiredBasis(
      makeJourney(),
      makeCompositeProjection(),
      undefined,
    )
    expect(basis.plannedAnnualDraw).toBe(0)
  })
})
