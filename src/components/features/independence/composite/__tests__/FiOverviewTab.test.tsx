import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type {
  CompositeProjectionResult,
  CompositePhase,
} from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

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

jest.mock("@components/features/independence/ChartFrame", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-frame">{children}</div>
  ),
}))

jest.mock("@lib/independence/ageAxis", () => ({
  ageAxisDomain: () => [55, 90],
  ageAxisTicks: () => [55, 60, 65, 70, 75, 80, 85, 90],
}))

jest.mock("@hooks/useCompositeMonteCarloSimulation", () => ({
  __esModule: true,
  default: () => ({
    result: null,
    isRunning: false,
    error: null,
    runSimulation: jest.fn(),
  }),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({ settings: undefined }),
}))

// ——— Fixtures ———

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 65, toAge: 90 },
]

function makeProjection(
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult {
  return {
    asOfDate: "2026-01-01",
    displayCurrency: "SGD",
    phases: [
      {
        planId: "p1",
        planName: "Plan 1",
        fromAge: 65,
        toAge: 90,
        expensesCurrency: "SGD",
      },
    ],
    totalAssets: 1_500_000,
    liquidAssets: 1_360_893,
    runwayYears: 30,
    isSustainable: true,
    yearlyProjections: [
      {
        age: 65,
        year: 2036,
        planId: "p1",
        planName: "Plan 1",
        startingBalance: 1_360_893,
        investmentReturns: 0,
        income: 0,
        expenses: 60_000,
        endingBalance: 1_360_893,
        nonSpendableValue: 0,
        totalWealth: 1_360_893,
        currency: "SGD",
      },
      {
        age: 70,
        year: 2041,
        planId: "p1",
        planName: "Plan 1",
        startingBalance: 1_360_893,
        investmentReturns: 0,
        income: 0,
        expenses: 60_000,
        endingBalance: 1_200_000,
        nonSpendableValue: 0,
        totalWealth: 1_200_000,
        currency: "SGD",
      },
    ],
    warnings: [],
    ...overrides,
  }
}

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeNarrative: "",
    setCompositeNarrative: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  }
}

import FiOverviewTab from "../tabs/FiOverviewTab"

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): ReturnType<typeof render> {
  const ctx = makeCtx(ctxOverrides)
  return render(
    <CompositeProjectionProvider value={ctx}>
      <FiOverviewTab />
    </CompositeProjectionProvider>,
  )
}

// =====================================================================
// Test A — backend fiNumber + fiProgress: renders unclamped (>100%)
// =====================================================================

describe("FiOverviewTab — backend-echo fiNumber/fiProgress", () => {
  it("renders 104% progress when backend sends fiProgress: 103.6 (unclamped)", () => {
    const projection = makeProjection({
      fiNumber: 1_313_100,
      fiProgress: 103.6,
      liquidAssets: 1_360_893,
    })
    renderWithCtx({ projection })
    // Math.round(103.6) = 104 — must show 104%, not 100%
    expect(screen.getByText("104%")).toBeInTheDocument()
    expect(screen.queryByText("100%")).not.toBeInTheDocument()
  })

  it("caps the progress bar fill width at 100% even when fiProgress > 100", () => {
    const projection = makeProjection({
      fiNumber: 1_313_100,
      fiProgress: 103.6,
      liquidAssets: 1_360_893,
    })
    renderWithCtx({ projection })
    // The label shows 104%, but the bar <div> must cap at 100%
    const progressBars = document.querySelectorAll("[style]")
    const cappedBar = Array.from(progressBars).find(
      (el) => (el as HTMLElement).style.width === "100%",
    )
    expect(cappedBar).toBeTruthy()
  })

  it("shows the FI-achieved message when liquidAssets >= fiNumber", () => {
    const projection = makeProjection({
      fiNumber: 1_313_100,
      fiProgress: 103.6,
      liquidAssets: 1_360_893,
    })
    renderWithCtx({ projection })
    expect(
      screen.getByText(/Portfolio covers your FI target/i),
    ).toBeInTheDocument()
  })
})

// =====================================================================
// Test B — missing fiNumber → no crash, progress absent
// =====================================================================

describe("FiOverviewTab — missing backend fiNumber", () => {
  it("does not crash when projection has no fiNumber", () => {
    const projection = makeProjection({
      // No fiNumber / fiProgress fields
      liquidAssets: 500_000,
    })
    expect(() => renderWithCtx({ projection })).not.toThrow()
  })

  it("does not render the FI progress bar when fiNumber is absent", () => {
    const projection = makeProjection({
      liquidAssets: 500_000,
    })
    renderWithCtx({ projection })
    // fiNumber = 0 → progress section is hidden
    expect(screen.queryByText(/Progress to FI/i)).not.toBeInTheDocument()
  })

  it("does not render the progress percentage when fiNumber is absent", () => {
    const projection = makeProjection({
      liquidAssets: 500_000,
    })
    renderWithCtx({ projection })
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })
})
