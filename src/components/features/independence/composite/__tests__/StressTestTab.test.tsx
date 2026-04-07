import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type {
  CompositePhase,
  MonteCarloResult,
} from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

// Mock the composite Monte Carlo hook so we can drive the component's
// rendering and assert against runSimulation.
const mockRunSimulation = jest.fn()
let mockHookState: {
  result: MonteCarloResult | null
  isRunning: boolean
  error: Error | null
} = {
  result: null,
  isRunning: false,
  error: null,
}

jest.mock("@hooks/useCompositeMonteCarloSimulation", () => ({
  __esModule: true,
  default: () => ({
    ...mockHookState,
    runSimulation: mockRunSimulation,
  }),
  useCompositeMonteCarloSimulation: () => ({
    ...mockHookState,
    runSimulation: mockRunSimulation,
  }),
}))

let mockHideValues = false
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: mockHideValues }),
}))

// Stub MonteCarloResultView so we can assert it renders without dragging
// in the full chart implementation (recharts + jsdom measurements).
jest.mock("../../monte-carlo/MonteCarloResultView", () => ({
  MonteCarloResultView: ({
    result,
    currency,
    hideValues,
  }: {
    result: MonteCarloResult
    currency: string
    hideValues: boolean
  }): React.ReactElement => (
    <div
      data-testid="monte-carlo-result-view"
      data-hide-values={String(hideValues)}
    >
      MC result {result.successRate}% {currency}
    </div>
  ),
}))

import StressTestTab from "../tabs/StressTestTab"

const fixtureResult: MonteCarloResult = {
  planId: "composite",
  iterations: 1000,
  successRate: 81.2,
  currency: "USD",
  deterministicRunwayYears: 30,
  terminalBalancePercentiles: {
    p5: 0,
    p10: 0,
    p25: 100,
    p50: 200,
    p75: 300,
    p90: 400,
    p95: 500,
  },
  yearlyBands: [],
  depletionAgeDistribution: {
    depletedCount: 100,
    survivedCount: 900,
    histogram: {},
  },
  parameters: {
    blendedReturnRate: 0.05,
    blendedVolatility: 0.1,
    inflationRate: 0.025,
    inflationVolatility: 0.01,
    housingReturnRate: 0.03,
    housingVolatility: 0.05,
    equityVolatility: 0.15,
    cashVolatility: 0.01,
    equityCashCorrelation: 0.0,
    investmentTaxRate: 0.0,
  },
}

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 65, toAge: 90 },
]

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  }
}

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): {
  ctx: CompositeProjectionValue
  rerender: (newCtx: CompositeProjectionValue) => void
} {
  const ctx = makeCtx(ctxOverrides)
  const utils = render(
    <CompositeProjectionProvider value={ctx}>
      <StressTestTab />
    </CompositeProjectionProvider>,
  )
  const rerender = (newCtx: CompositeProjectionValue): void => {
    utils.rerender(
      <CompositeProjectionProvider value={newCtx}>
        <StressTestTab />
      </CompositeProjectionProvider>,
    )
  }
  return { ctx, rerender }
}

describe("StressTestTab", () => {
  beforeEach(() => {
    mockRunSimulation.mockReset()
    mockHookState = { result: null, isRunning: false, error: null }
    mockHideValues = false
  })

  it("disables Run button when no phases are configured", () => {
    renderWithCtx({ phases: [] })
    expect(
      screen.getByRole("button", { name: /Run Stress Test/i }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Add at least one phase to run a stress test/i),
    ).toBeInTheDocument()
  })

  it("enables Run button when phases exist", () => {
    renderWithCtx()
    expect(
      screen.getByRole("button", { name: /Run Stress Test/i }),
    ).toBeEnabled()
  })

  it("calls runSimulation with the chosen iterations and ctx values when Run is clicked", async () => {
    const user = userEvent.setup()
    renderWithCtx()

    // Default iterations = 1000
    await user.click(
      screen.getByRole("button", { name: /Run Stress Test/i }),
    )

    expect(mockRunSimulation).toHaveBeenCalledTimes(1)
    expect(mockRunSimulation).toHaveBeenCalledWith({
      iterations: 1000,
      phases: defaultPhases,
      displayCurrency: "USD",
    })
  })

  it("uses the selected iterations value when Run is clicked", async () => {
    const user = userEvent.setup()
    renderWithCtx()

    await user.selectOptions(
      screen.getByLabelText(/Iterations/i),
      "5000",
    )
    await user.click(
      screen.getByRole("button", { name: /Run Stress Test/i }),
    )

    expect(mockRunSimulation).toHaveBeenCalledWith(
      expect.objectContaining({ iterations: 5000 }),
    )
  })

  it("renders MonteCarloResultView when a result is available", () => {
    mockHookState = { result: fixtureResult, isRunning: false, error: null }
    renderWithCtx()
    expect(screen.getByTestId("monte-carlo-result-view")).toBeInTheDocument()
  })

  it("forwards hideValues from usePrivacyMode to MonteCarloResultView", () => {
    mockHideValues = true
    mockHookState = { result: fixtureResult, isRunning: false, error: null }
    renderWithCtx()
    const view = screen.getByTestId("monte-carlo-result-view")
    expect(view).toHaveAttribute("data-hide-values", "true")
  })

  it("passes hideValues=false when privacy mode is off", () => {
    mockHideValues = false
    mockHookState = { result: fixtureResult, isRunning: false, error: null }
    renderWithCtx()
    const view = screen.getByTestId("monte-carlo-result-view")
    expect(view).toHaveAttribute("data-hide-values", "false")
  })

  it("shows an error message on failure", () => {
    mockHookState = {
      result: null,
      isRunning: false,
      error: new Error("simulation exploded"),
    }
    renderWithCtx()

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(/simulation exploded/i)
  })

  it("marks results stale when phases change after a run", () => {
    mockHookState = { result: fixtureResult, isRunning: false, error: null }
    const { rerender } = renderWithCtx()

    // No stale indicator on initial render with a result.
    expect(
      screen.queryByText(/Results are stale/i),
    ).not.toBeInTheDocument()

    // Change the phases — should trigger the stale state.
    rerender(
      makeCtx({
        phases: [{ planId: "p1", fromAge: 60, toAge: 85 }],
      }),
    )

    expect(screen.getByText(/Results are stale/i)).toBeInTheDocument()
  })

  it("marks results stale when displayCurrency changes after a run", () => {
    mockHookState = { result: fixtureResult, isRunning: false, error: null }
    const { rerender } = renderWithCtx()

    rerender(makeCtx({ displayCurrency: "SGD" }))

    expect(screen.getByText(/Results are stale/i)).toBeInTheDocument()
  })

  it("disables Run button while isRunning", () => {
    mockHookState = { result: null, isRunning: true, error: null }
    renderWithCtx()
    expect(
      screen.getByRole("button", { name: /Running/i }),
    ).toBeDisabled()
  })
})
