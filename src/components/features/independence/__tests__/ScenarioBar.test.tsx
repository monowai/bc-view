import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import ScenarioBar from "../ScenarioBar"
import { DEFAULT_SCENARIO_STATE } from "../scenario/types"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: jest.fn(() => ({
    hideValues: false,
    toggleHideValues: jest.fn(),
  })),
}))

const baseScenario = {
  ...DEFAULT_SCENARIO_STATE,
  currentAge: 46,
  retirementAge: 60,
  lifeExpectancy: 92,
  monthlyExpenses: 4500,
  pensionMonthly: 800,
  otherIncomeMonthly: 200,
  inflation: 0.025,
}

const baseProps = {
  scenario: baseScenario,
  onScenarioChange: jest.fn(),
  onReset: jest.fn(),
  onSave: jest.fn(),
  isDirty: false,
  currency: "SGD",
  view: "FIRE" as const,
  onViewChange: jest.fn(),
  derivedLiquidAssets: 250_000,
  planInflation: 0.025,
  planCashRate: 0.015,
  planEquityRate: 0.07,
  planCashAlloc: 1.0,
}

beforeEach(() => {
  baseProps.onScenarioChange.mockClear()
  baseProps.onReset.mockClear()
  baseProps.onSave.mockClear()
})

describe("ScenarioBar", () => {
  it("renders slider labels when expanded", () => {
    render(<ScenarioBar {...baseProps} />)
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    for (const label of [
      "Retirement Age",
      "Life Expectancy",
      "Liquid Assets",
      "Monthly Expenses",
      "Government Benefits",
      "Other Income",
      "Inflation",
      "Cash → Investments",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText("Pension / CPF")).not.toBeInTheDocument()
    expect(screen.queryByText("Real Return")).not.toBeInTheDocument()
  })

  it("collapses the slider grid by default and toggles open", () => {
    render(<ScenarioBar {...baseProps} />)
    expect(screen.queryByText("Retirement Age")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    expect(screen.getByText("Retirement Age")).toBeInTheDocument()
  })

  it("shows a Modified badge when isDirty is true", () => {
    render(<ScenarioBar {...baseProps} isDirty />)
    expect(screen.getByText("Modified")).toBeInTheDocument()
  })

  it("disables Reset and hides Save when not dirty", () => {
    render(<ScenarioBar {...baseProps} />)
    expect(screen.getByRole("button", { name: /Reset/ })).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: /Save Scenario/ }),
    ).not.toBeInTheDocument()
  })

  it("shows Save only once the scenario is dirty", () => {
    const { rerender } = render(<ScenarioBar {...baseProps} />)
    expect(
      screen.queryByRole("button", { name: /Save Scenario/ }),
    ).not.toBeInTheDocument()
    rerender(<ScenarioBar {...baseProps} isDirty />)
    expect(
      screen.getByRole("button", { name: /Save Scenario/ }),
    ).toBeInTheDocument()
  })

  it("calls onSave + onReset when buttons clicked while dirty", () => {
    render(<ScenarioBar {...baseProps} isDirty />)
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }))
    expect(baseProps.onReset).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: /Save Scenario/ }))
    expect(baseProps.onSave).toHaveBeenCalledTimes(1)
  })

  it("writes liquidAssets=number when slider moves away from the derived value", () => {
    render(<ScenarioBar {...baseProps} />)
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    const liquidSlider = screen
      .getByText("Liquid Assets")
      .closest(".space-y-2")
      ?.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(liquidSlider, { target: { value: "200000" } })
    expect(baseProps.onScenarioChange).toHaveBeenCalledWith({
      liquidAssets: 200000,
    })
  })

  it("restores liquidAssets=null when the slider returns to the derived value", () => {
    const props = {
      ...baseProps,
      scenario: { ...baseScenario, liquidAssets: 100_000 },
    }
    render(<ScenarioBar {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    const liquidSlider = screen
      .getByText("Liquid Assets")
      .closest(".space-y-2")
      ?.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(liquidSlider, {
      target: { value: String(baseProps.derivedLiquidAssets) },
    })
    expect(props.onScenarioChange).toHaveBeenCalledWith({ liquidAssets: null })
  })

  describe("path-to-horizon", () => {
    const offTrack = {
      targetAge: 90,
      currentMonthlyContribution: 1000,
      requiredMonthlyContribution: 1800,
      currentReturnRate: 0.015,
      requiredReturnRate: 0.0432,
    }

    it("does NOT render the off-track banner (now a backend Plan Insight)", () => {
      render(<ScenarioBar {...baseProps} pathToHorizon={offTrack} />)
      // The "what it takes" guidance moved to the backend OFF_TRACK finding
      // (PlanFindingsCard) — it must not be re-rendered here.
      expect(screen.queryByText(/Won.t last to age/)).not.toBeInTheDocument()
      expect(screen.queryByText(/To last to age 90/)).not.toBeInTheDocument()
      expect(screen.queryByText(/SGD1,800/)).not.toBeInTheDocument()
    })

    it("keeps the off-track caveat out of the headline gauge value", () => {
      render(
        <ScenarioBar
          {...baseProps}
          view="PENSION"
          fiMetrics={
            { fiProgress: 80, retirementAgeFiProgress: 125.3 } as never
          }
          pathToHorizon={offTrack}
        />,
      )
      // Value stays clean; the 4%-rule explanation moved to the gauge tooltip.
      expect(screen.getByText("125.3%")).toBeInTheDocument()
      expect(
        screen.queryByText(/125\.3% — based on the 4% rule/),
      ).not.toBeInTheDocument()
    })

    it("labels the headline gauge 'Retirement-Age Progress'", () => {
      render(
        <ScenarioBar
          {...baseProps}
          view="PENSION"
          fiMetrics={
            { fiProgress: 80, retirementAgeFiProgress: 125.3 } as never
          }
          pathToHorizon={offTrack}
        />,
      )
      expect(screen.getByText("Retirement-Age Progress")).toBeInTheDocument()
    })
  })

  it("shows blended return at 0% shift (motivates moving cash to investments)", () => {
    render(<ScenarioBar {...baseProps} />)
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    // 0% shift: 100% cash at 1.5% → blended=1.5%, real=1.5%-2.5%=-1.0% (red)
    expect(screen.getByText(/Expected:/)).toBeInTheDocument()
    expect(screen.getByText(/-1\.0% real/)).toBeInTheDocument()
  })

  it("shows positive real return when cash is shifted to investments", () => {
    render(
      <ScenarioBar
        {...baseProps}
        scenario={{ ...baseScenario, cashToInvestPercent: 50 }}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    // 50% shift: 0.5*1.5% + 0.5*7% = 0.75% + 3.5% = 4.25% blended, real=1.75%
    expect(screen.getByText(/\+1\.8% real/)).toBeInTheDocument()
  })
})
