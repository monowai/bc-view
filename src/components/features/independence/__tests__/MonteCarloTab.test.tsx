import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type {
  MonteCarloResult,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import type { AssetBreakdown } from "../useAssetBreakdown"
import type { UseMonteCarloSimulationProps } from "../useMonteCarloSimulation"

// Capture the last props passed to the hook so we can assert on them.
const mockRunSimulation = jest.fn()
let capturedHookProps: UseMonteCarloSimulationProps | undefined = undefined
let mockHookResult: MonteCarloResult | null = null
let mockIsRunning = false

jest.mock("../useMonteCarloSimulation", () => ({
  useMonteCarloSimulation: (props: UseMonteCarloSimulationProps) => {
    capturedHookProps = props
    return {
      result: mockHookResult,
      isRunning: mockIsRunning,
      error: null,
      runSimulation: mockRunSimulation,
    }
  },
}))

// Stabilise Recharts: ResponsiveContainer relies on element measurements that
// jsdom doesn't compute, so we render a fixed-size container instead. Without
// this the chart renders as an empty wrapper and the snapshot loses content.
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts")
  return {
    ...OriginalModule,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  }
})

import MonteCarloTab from "../MonteCarloTab"
import { fixtureMonteCarloResult } from "../__fixtures__/monteCarloResult"

function makePlan(): RetirementPlan {
  return {
    id: "plan-1",
    ownerId: "owner-1",
    name: "Snapshot Plan",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    yearOfBirth: 1965,
    monthlyExpenses: 4000,
    expensesCurrency: "SGD",
    targetBalance: 0,
    cashReturnRate: 0.02,
    equityReturnRate: 0.07,
    housingReturnRate: 0.03,
    inflationRate: 0.03,
    cashAllocation: 20,
    equityAllocation: 60,
    housingAllocation: 20,
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 80,
    isPrimary: true,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
  }
}

const assets: AssetBreakdown = {
  liquidAssets: 500_000,
  nonSpendableAssets: 250_000,
  totalAssets: 750_000,
  hasAssets: true,
  isLoaded: true,
}

import { DEFAULT_SCENARIO_STATE } from "../scenario/types"
const scenario = {
  ...DEFAULT_SCENARIO_STATE,
  currentAge: 60,
  retirementAge: 65,
  lifeExpectancy: 90,
  monthlyExpenses: 4000,
  inflation: 0.025,
}

const displayProjection: RetirementProjection = {
  planId: "plan-1",
  asOfDate: "2026-01-01",
  totalAssets: 750_000,
  liquidAssets: 500_000,
  monthlyExpenses: 4000,
  runwayMonths: 336,
  runwayYears: 28,
  currency: "SGD",
  nonSpendableAtRetirement: 250_000,
  housingReturnRate: 0.03,
  yearlyProjections: [
    {
      year: 2026,
      age: 60,
      startingBalance: 500_000,
      investment: 25_000,
      withdrawals: 48_000,
      endingBalance: 530_000,
      inflationAdjustedExpenses: 48_000,
      currency: "SGD",
      nonSpendableValue: 250_000,
      totalWealth: 780_000,
    },
    {
      year: 2031,
      age: 65,
      startingBalance: 600_000,
      investment: 30_000,
      withdrawals: 55_000,
      endingBalance: 650_000,
      inflationAdjustedExpenses: 55_000,
      currency: "SGD",
      nonSpendableValue: 290_000,
      totalWealth: 940_000,
    },
    {
      year: 2036,
      age: 70,
      startingBalance: 680_000,
      investment: 32_000,
      withdrawals: 64_000,
      endingBalance: 700_000,
      inflationAdjustedExpenses: 64_000,
      currency: "SGD",
      nonSpendableValue: 335_000,
      totalWealth: 1_035_000,
    },
    {
      year: 2041,
      age: 75,
      startingBalance: 700_000,
      investment: 30_000,
      withdrawals: 74_000,
      endingBalance: 680_000,
      inflationAdjustedExpenses: 74_000,
      currency: "SGD",
      nonSpendableValue: 388_000,
      totalWealth: 1_068_000,
    },
    {
      year: 2046,
      age: 80,
      startingBalance: 680_000,
      investment: 28_000,
      withdrawals: 86_000,
      endingBalance: 600_000,
      inflationAdjustedExpenses: 86_000,
      currency: "SGD",
      nonSpendableValue: 450_000,
      totalWealth: 1_050_000,
    },
    {
      year: 2051,
      age: 85,
      startingBalance: 600_000,
      investment: 22_000,
      withdrawals: 99_000,
      endingBalance: 480_000,
      inflationAdjustedExpenses: 99_000,
      currency: "SGD",
      nonSpendableValue: 522_000,
      totalWealth: 1_002_000,
    },
    {
      year: 2056,
      age: 90,
      startingBalance: 480_000,
      investment: 16_000,
      withdrawals: 115_000,
      endingBalance: 320_000,
      inflationAdjustedExpenses: 115_000,
      currency: "SGD",
      nonSpendableValue: 605_000,
      totalWealth: 925_000,
    },
  ],
}

const mockProps = {
  plan: makePlan(),
  assets,
  monthlyInvestment: 2000,
  scenario,
  rentalIncome: undefined,
  displayCurrency: "SGD",
  hideValues: false,
  currency: "S$",
  displayProjection,
}

describe("MonteCarloTab snapshot baseline", () => {
  beforeEach(() => {
    capturedHookProps = undefined
    mockRunSimulation.mockClear()
    mockHookResult = fixtureMonteCarloResult
    mockIsRunning = false
  })

  it("matches snapshot with fixture result", () => {
    const { container } = render(<MonteCarloTab {...mockProps} />)
    expect(container).toMatchSnapshot()
  })
})

describe("MonteCarloTab — never-force-sell illiquid toggle", () => {
  beforeEach(() => {
    capturedHookProps = undefined
    mockRunSimulation.mockClear()
    mockHookResult = null
    mockIsRunning = false
  })

  it("renders the toggle unchecked by default", () => {
    render(<MonteCarloTab {...mockProps} />)
    const toggle = screen.getByRole("checkbox", {
      name: /Never force-sell illiquid/i,
    })
    expect(toggle).toBeInTheDocument()
    expect(toggle).not.toBeChecked()
  })

  it("passes neverSellIlliquid as falsy to the hook when toggle is OFF", () => {
    render(<MonteCarloTab {...mockProps} />)
    expect(capturedHookProps?.neverSellIlliquid).toBeFalsy()
  })

  it("passes neverSellIlliquid: true to the hook after toggling ON", async () => {
    const user = userEvent.setup()
    render(<MonteCarloTab {...mockProps} />)

    await user.click(
      screen.getByRole("checkbox", { name: /Never force-sell illiquid/i }),
    )

    // React re-renders after toggle → hook called with updated props
    expect(capturedHookProps?.neverSellIlliquid).toBe(true)
  })

  it("disables the toggle while the simulation is running", () => {
    mockIsRunning = true
    render(<MonteCarloTab {...mockProps} />)
    expect(
      screen.getByRole("checkbox", { name: /Never force-sell illiquid/i }),
    ).toBeDisabled()
  })
})
