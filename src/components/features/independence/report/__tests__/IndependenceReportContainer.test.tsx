import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceReportContainer from "@components/features/independence/report/IndependenceReportContainer"
import { makeReportProjection } from "@lib/independence/report/__fixtures__/reportProjection"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import { reportSeed } from "@lib/independence/report/reportSeed"
import type { RetirementPlan } from "types/independence"
import type { UseMonteCarloSimulationProps } from "@components/features/independence/useMonteCarloSimulation"
import { DEFAULT_SCENARIO_STATE } from "@components/features/independence/scenario/types"

const mockRunSimulation = jest.fn()
let capturedHookProps: UseMonteCarloSimulationProps | undefined

jest.mock("@components/features/independence/useMonteCarloSimulation", () => ({
  useMonteCarloSimulation: (props: UseMonteCarloSimulationProps) => {
    capturedHookProps = props
    return {
      result: fixtureMonteCarloResult,
      isRunning: false,
      error: null,
      runSimulation: mockRunSimulation,
    }
  },
}))
jest.mock("@components/features/independence/usePlanExpenses", () => ({
  usePlanExpenses: () => ({ expenses: [], isLoading: false }),
}))
jest.mock("@components/features/independence/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ labels: [], isLoading: false }),
}))
jest.mock("@components/features/independence/useLifestyleCatalog", () => ({
  useLifestyleCatalog: () => ({ catalog: null }),
}))
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

const plan = {
  id: "plan-1",
  name: "Base plan",
  expensesCurrency: "SGD",
} as RetirementPlan
const projection = makeReportProjection()

const props = {
  plan,
  projection,
  baselineProjection: null,
  assets: {
    liquidAssets: 1_300_000,
    nonSpendableAssets: 1_050_000,
    totalAssets: 2_350_000,
    hasAssets: true,
    isLoaded: true,
  },
  scenario: DEFAULT_SCENARIO_STATE,
  effectiveCurrency: "S$",
  planCurrency: "SGD",
  ages: { currentAge: 52, retirementAge: 60, lifeExpectancy: 90 },
  hideValues: false,
}

describe("IndependenceReportContainer", () => {
  beforeEach(() => {
    mockRunSimulation.mockClear()
    capturedHookProps = undefined
  })

  it("should run one seeded simulation derived from plan id and as-of date", () => {
    render(<IndependenceReportContainer {...props} />)
    expect(capturedHookProps?.seed).toBe(reportSeed("plan-1", "2026-09-28"))
    expect(mockRunSimulation).toHaveBeenCalledTimes(1)
  })

  it("should print the same seed it sent", () => {
    render(<IndependenceReportContainer {...props} />)
    expect(screen.getByTestId("report-stress")).toHaveTextContent(
      String(reportSeed("plan-1", "2026-09-28")),
    )
  })
})
