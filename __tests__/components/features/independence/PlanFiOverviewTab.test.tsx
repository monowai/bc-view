import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  buildTrajectorySeries,
  default as PlanFiOverviewTab,
} from "@components/features/independence/PlanFiOverviewTab"
import type {
  RetirementPlan,
  RetirementProjection,
  YearlyAccumulation,
  YearlyProjection,
} from "types/independence"
import type { ScenarioState } from "@components/features/independence/scenario/types"
import type { AssetBreakdown } from "@components/features/independence/useAssetBreakdown"

// ——— Module mocks ———

jest.mock("recharts", () => ({
  __esModule: true,
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  ReferenceArea: () => null,
}))

function MockChartFrame({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <div data-testid="chart-frame">{children}</div>
}
jest.mock("@components/features/independence/ChartFrame", () => MockChartFrame)

jest.mock("@lib/independence/ageAxis", () => ({
  ageAxisDomain: () => [30, 85],
  ageAxisTicks: () => [30, 40, 50, 60, 70, 80, 85],
}))

const mockRunSimulation = jest.fn()
const mockUseMonteCarloSimulation = jest.fn()

jest.mock("@components/features/independence/useMonteCarloSimulation", () => ({
  useMonteCarloSimulation: (
    ...args: Parameters<typeof mockUseMonteCarloSimulation>
  ) => mockUseMonteCarloSimulation(...args),
}))

// ——— Fixtures ———

function makeAccRow(
  overrides: Partial<YearlyAccumulation> = {},
): YearlyAccumulation {
  return {
    year: 2030,
    age: 35,
    startingBalance: 50_000,
    contribution: 12_000,
    investmentGrowth: 3_000,
    endingBalance: 65_000,
    nonSpendableValue: 0,
    totalWealth: 65_000,
    currency: "SGD",
    ...overrides,
  }
}

function makeDrawdownRow(
  overrides: Partial<YearlyProjection> = {},
): YearlyProjection {
  return {
    year: 2055,
    age: 60,
    startingBalance: 800_000,
    investment: 40_000,
    withdrawals: 36_000,
    endingBalance: 804_000,
    inflationAdjustedExpenses: 36_000,
    currency: "SGD",
    nonSpendableValue: 0,
    totalWealth: 804_000,
    ...overrides,
  }
}

const basePlan: RetirementPlan = {
  id: "plan-1",
  ownerId: "owner-1",
  name: "Test Plan",
  planningHorizonYears: 30,
  lifeExpectancy: 85,
  yearOfBirth: 1985,
  monthlyExpenses: 3_000,
  expensesCurrency: "SGD",
  cashReturnRate: 0.02,
  equityReturnRate: 0.07,
  housingReturnRate: 0.03,
  inflationRate: 0.025,
  cashAllocation: 20,
  equityAllocation: 80,
  housingAllocation: 0,
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  workingIncomeMonthly: 5_000,
  workingExpensesMonthly: 2_000,
  taxesMonthly: 500,
  bonusMonthly: 0,
  investmentAllocationPercent: 80,
  isPrimary: true,
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

const baseProjection: RetirementProjection = {
  planId: "plan-1",
  asOfDate: "2024-01-01",
  totalAssets: 800_000,
  liquidAssets: 800_000,
  monthlyExpenses: 3_000,
  runwayMonths: 360,
  runwayYears: 30,
  nonSpendableAtRetirement: 0,
  housingReturnRate: 0.03,
  currency: "SGD",
  yearlyProjections: [makeDrawdownRow()],
  fiMetrics: {
    fiNumber: 900_000,
    fiProgress: 88,
    gapToFi: 100_000,
    netMonthlyExpenses: 3_000,
    totalMonthlyIncome: 0,
    isCoastFire: false,
    isFinanciallyIndependent: false,
  },
}

const baseScenario: ScenarioState = {
  currentAge: 35,
  retirementAge: 60,
  lifeExpectancy: 85,
  liquidAssets: null,
  monthlyExpenses: 3_000,
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  realReturn: null,
  inflation: 0.025,
  cashToInvestPercent: 0,
}

const baseAssets: AssetBreakdown = {
  liquidAssets: 800_000,
  nonSpendableAssets: 0,
  totalAssets: 800_000,
  hasAssets: true,
  isLoaded: true,
}

function renderTab(
  overrides: Partial<React.ComponentProps<typeof PlanFiOverviewTab>> = {},
): ReturnType<typeof render> {
  // Default: no MC result
  mockUseMonteCarloSimulation.mockReturnValue({
    result: null,
    isRunning: false,
    error: null,
    runSimulation: mockRunSimulation,
  })
  return render(
    <PlanFiOverviewTab
      plan={basePlan}
      projection={baseProjection}
      scenario={baseScenario}
      assets={baseAssets}
      monthlyInvestment={1_000}
      rentalIncome={undefined}
      displayCurrency={undefined}
      effectiveCurrency="SGD"
      currentAge={35}
      isCalculating={false}
      hideValues={false}
      {...overrides}
    />,
  )
}

// =====================================================================
// buildTrajectorySeries — pure helper tests
// =====================================================================

describe("buildTrajectorySeries", () => {
  it("returns an empty array when both accumulation and drawdown are empty", () => {
    const projection = {
      ...baseProjection,
      yearlyProjections: [],
      accumulationProjections: [],
    }
    expect(buildTrajectorySeries(projection)).toEqual([])
  })

  it("returns only drawdown rows when there are no accumulation projections", () => {
    const row = makeDrawdownRow({ age: 60, year: 2055, endingBalance: 800_000 })
    const projection = {
      ...baseProjection,
      yearlyProjections: [row],
      accumulationProjections: undefined,
    }
    const result = buildTrajectorySeries(projection)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      age: 60,
      year: 2055,
      endingBalance: 800_000,
    })
  })

  it("returns only accumulation rows when yearlyProjections is empty", () => {
    const acc = makeAccRow({ age: 35, year: 2030, endingBalance: 65_000 })
    const projection = {
      ...baseProjection,
      yearlyProjections: [],
      accumulationProjections: [acc],
    }
    const result = buildTrajectorySeries(projection)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      age: 35,
      year: 2030,
      endingBalance: 65_000,
    })
  })

  it("accumulation ages precede retirement ages in the combined series", () => {
    const acc1 = makeAccRow({ age: 35, year: 2030, endingBalance: 50_000 })
    const acc2 = makeAccRow({ age: 40, year: 2035, endingBalance: 120_000 })
    const dd1 = makeDrawdownRow({ age: 60, year: 2055, endingBalance: 800_000 })
    const dd2 = makeDrawdownRow({ age: 61, year: 2056, endingBalance: 780_000 })
    const projection = {
      ...baseProjection,
      yearlyProjections: [dd1, dd2],
      accumulationProjections: [acc1, acc2],
    }
    const result = buildTrajectorySeries(projection)
    const ages = result.map((r) => r.age)
    // acc rows come first
    expect(ages[0]).toBe(35)
    expect(ages[1]).toBe(40)
    // drawdown rows follow
    expect(ages[2]).toBe(60)
    expect(ages[3]).toBe(61)
  })

  it("drops the last accumulation row when it shares an age with the first drawdown row", () => {
    // Retirement age appears in both arrays (e.g., age 60)
    const acc1 = makeAccRow({ age: 55, year: 2050, endingBalance: 500_000 })
    const accAtBoundary = makeAccRow({
      age: 60,
      year: 2055,
      endingBalance: 800_000,
    })
    const dd1 = makeDrawdownRow({ age: 60, year: 2055, endingBalance: 800_000 })
    const dd2 = makeDrawdownRow({ age: 61, year: 2056, endingBalance: 782_000 })
    const projection = {
      ...baseProjection,
      yearlyProjections: [dd1, dd2],
      accumulationProjections: [acc1, accAtBoundary],
    }
    const result = buildTrajectorySeries(projection)
    // acc at age 60 deduped; should have acc55 + dd60 + dd61
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.age)).toEqual([55, 60, 61])
  })

  it("does not drop an accumulation row when no overlap exists", () => {
    const acc = makeAccRow({ age: 59, year: 2054, endingBalance: 790_000 })
    const dd = makeDrawdownRow({ age: 60, year: 2055, endingBalance: 800_000 })
    const projection = {
      ...baseProjection,
      yearlyProjections: [dd],
      accumulationProjections: [acc],
    }
    const result = buildTrajectorySeries(projection)
    expect(result).toHaveLength(2)
    expect(result[0].age).toBe(59)
    expect(result[1].age).toBe(60)
  })
})

// =====================================================================
// Income-basis collapsible
// =====================================================================

describe("income basis collapsible", () => {
  it("renders the section title under the KPI row, collapsed by default", () => {
    renderTab()
    expect(
      screen.getByText("How your FI Target is calculated"),
    ).toBeInTheDocument()
    // Content should be hidden (not in DOM) when collapsed
    expect(
      screen.queryByText("Monthly retirement expenses"),
    ).not.toBeInTheDocument()
  })

  it("expands and shows content when the title button is clicked", () => {
    renderTab()
    fireEvent.click(screen.getByText("How your FI Target is calculated"))
    expect(screen.getByText("Monthly retirement expenses")).toBeInTheDocument()
  })

  it("shows the FI Number formula row after expanding", () => {
    renderTab()
    fireEvent.click(screen.getByText("How your FI Target is calculated"))
    expect(
      screen.getByText(/25× annual net spend at the 4% rule/),
    ).toBeInTheDocument()
  })
})

// =====================================================================
// MC slim panel — results grid removed, stress test link
// =====================================================================

describe("Monte Carlo slim panel", () => {
  const mcResult = {
    planId: "plan-1",
    iterations: 1000,
    successRate: 85,
    terminalBalancePercentiles: {
      p5: 100_000,
      p10: 150_000,
      p25: 300_000,
      p50: 600_000,
      p75: 900_000,
      p90: 1_200_000,
      p95: 1_500_000,
    },
    yearlyBands: [],
    depletionAgeDistribution: {
      depletedCount: 50,
      survivedCount: 950,
      histogram: {},
    },
    deterministicRunwayYears: 30,
    currency: "SGD",
    parameters: {
      blendedReturnRate: 0.06,
      blendedVolatility: 0.12,
      inflationRate: 0.025,
      inflationVolatility: 0.01,
      housingReturnRate: 0.03,
      housingVolatility: 0.05,
      equityVolatility: 0.15,
      cashVolatility: 0.02,
      equityCashCorrelation: -0.2,
      investmentTaxRate: 0,
    },
    nonSpendableAtStart: 0,
    liquidatedCount: 0,
  }

  function renderWithMcResult(onOpenStressTest?: () => void): void {
    mockUseMonteCarloSimulation.mockReturnValue({
      result: mcResult,
      isRunning: false,
      error: null,
      runSimulation: mockRunSimulation,
    })
    render(
      <PlanFiOverviewTab
        plan={basePlan}
        projection={baseProjection}
        scenario={baseScenario}
        assets={baseAssets}
        monthlyInvestment={1_000}
        rentalIncome={undefined}
        displayCurrency={undefined}
        effectiveCurrency="SGD"
        currentAge={35}
        isCalculating={false}
        hideValues={false}
        onOpenStressTest={onOpenStressTest}
      />,
    )
  }

  it("does not render the old 4-card MC results grid after a simulation run", () => {
    renderWithMcResult()
    expect(screen.queryByText("Median End Balance")).not.toBeInTheDocument()
    expect(screen.queryByText("Worst 10% Outcome")).not.toBeInTheDocument()
    expect(screen.queryByText("Depletion Risk")).not.toBeInTheDocument()
  })

  it("shows the stress-test redirect text after a simulation run", () => {
    renderWithMcResult()
    expect(
      screen.getByText(
        /Full percentile bands, depletion analysis and terminal balances/,
      ),
    ).toBeInTheDocument()
  })

  it("renders the 'Full stress test →' button when onOpenStressTest is provided", () => {
    const onOpenStressTest = jest.fn()
    renderWithMcResult(onOpenStressTest)
    expect(
      screen.getByRole("button", { name: "Full stress test →" }),
    ).toBeInTheDocument()
  })

  it("calls onOpenStressTest when the button is clicked", () => {
    const onOpenStressTest = jest.fn()
    renderWithMcResult(onOpenStressTest)
    fireEvent.click(screen.getByRole("button", { name: "Full stress test →" }))
    expect(onOpenStressTest).toHaveBeenCalledTimes(1)
  })

  it("does not render the stress test button when onOpenStressTest is not provided", () => {
    renderWithMcResult(undefined)
    expect(
      screen.queryByRole("button", { name: "Full stress test →" }),
    ).not.toBeInTheDocument()
  })

  describe("stacked FI progress (portfolio + guaranteed income)", () => {
    it("renders the Social Security segment and combined 'incl. income' total", () => {
      renderTab({
        projection: {
          ...baseProjection,
          fiMetrics: {
            ...baseProjection.fiMetrics!,
            fiProgress: 82,
            retirementAgeFiProgress: 106,
          },
        },
      })
      expect(screen.getByText("+ Social Security")).toBeInTheDocument()
      expect(screen.getByText("incl. income")).toBeInTheDocument()
      // Combined total shown with overflow (unclamped, rounded).
      expect(screen.getByText(/106%/)).toBeInTheDocument()
    })

    it("omits the Social Security segment when there is no guaranteed income", () => {
      renderTab()
      expect(screen.queryByText("+ Social Security")).not.toBeInTheDocument()
      expect(screen.queryByText("incl. income")).not.toBeInTheDocument()
    })
  })
})
