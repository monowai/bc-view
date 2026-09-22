import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositeProjectionResult } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

// Recharts renders nothing measurable in JSDOM. Stub it, but keep the one
// thing this suite is about: ReferenceLine labels, which is where the chart
// makes its claims in words ("Age 61", "Target S$1.81M").
jest.mock("recharts", () => {
  const passthrough = (
    testId: string,
  ): ((props: { label?: { value?: string } }) => React.ReactElement) => {
    const Stub = ({
      label,
    }: {
      label?: { value?: string }
    }): React.ReactElement => (
      <div data-testid={testId}>{label?.value ?? ""}</div>
    )
    Stub.displayName = `Stub(${testId})`
    return Stub
  }
  return {
    ComposedChart: ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => <div data-testid="chart">{children}</div>,
    Line: () => <div />,
    Area: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    ReferenceLine: passthrough("reference-line"),
    ReferenceArea: passthrough("reference-area"),
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => <div>{children}</div>,
  }
})

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

import WealthOverTime from "../WealthOverTime"

const row = (age: number, endingBalance: number): never =>
  ({
    age,
    year: 2026 + (age - 61),
    endingBalance,
    startingBalance: endingBalance,
  }) as never

const projection = (
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult =>
  ({
    asOfDate: "2026-09-18",
    displayCurrency: "SGD",
    phases: [],
    totalAssets: 0,
    liquidAssets: 500_000,
    fiNumber: 1_810_000,
    runwayYears: 30,
    isSustainable: true,
    yearlyProjections: [
      row(61, 1_000_000),
      row(62, 1_900_000),
      row(63, 2_000_000),
    ],
    warnings: [],
    ...overrides,
  }) as CompositeProjectionResult

function renderWithCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): void {
  const ctx = {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    currentAge: 59,
    projection: projection(),
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: { result: null, isRunning: false, error: null, run: jest.fn() },
    ...overrides,
  } as CompositeProjectionValue

  render(
    <CompositeProjectionProvider value={ctx}>
      <WealthOverTime />
    </CompositeProjectionProvider>,
  )
}

describe("WealthOverTime crossing marker", () => {
  it("marks the age the balance reaches the target", () => {
    renderWithCtx()
    expect(screen.getByText("Age 62")).toBeInTheDocument()
  })

  it("marks no crossing when the target is already met today", () => {
    // The crossing is scanned over drawdown rows, which start at the plan's
    // retirement age — so someone already past the target gets a marker on
    // the very first point of the chart, labelling the plan's start as the
    // moment they arrived. The verdict above the chart says "today".
    renderWithCtx({ projection: projection({ liquidAssets: 2_429_000 }) })
    expect(screen.queryByText(/^Age \d+$/)).not.toBeInTheDocument()
  })
})
