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
  planBlendedReturn: 0.058,
  planInflation: 0.025,
}

beforeEach(() => {
  baseProps.onScenarioChange.mockClear()
  baseProps.onReset.mockClear()
  baseProps.onSave.mockClear()
})

describe("ScenarioBar", () => {
  it("renders all eight slider labels when expanded", () => {
    render(<ScenarioBar {...baseProps} />)
    // Expand the slider grid (collapsed by default).
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    for (const label of [
      "Retirement Age",
      "Life Expectancy",
      "Liquid Assets",
      "Monthly Expenses",
      "Pension / CPF",
      "Other Income",
      "Real Return",
      "Inflation",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
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

  describe("path-to-horizon header", () => {
    const offTrack = {
      targetAge: 90,
      currentMonthlyContribution: 1000,
      requiredMonthlyContribution: 1800,
      currentReturnRate: 0.015,
      requiredReturnRate: 0.0432,
    }

    it("shows the off-track banner above the gauge strip when pathToHorizon is present", () => {
      render(<ScenarioBar {...baseProps} pathToHorizon={offTrack} />)
      expect(screen.getByText(/Won.t last to age 90/)).toBeInTheDocument()
      expect(screen.getByText(/To last to age 90/)).toBeInTheDocument()
      expect(screen.getByText(/SGD1,800/)).toBeInTheDocument()
    })

    it("hides the off-track banner when on-track (no pathToHorizon)", () => {
      render(<ScenarioBar {...baseProps} />)
      expect(screen.queryByText(/Won.t last to age/)).not.toBeInTheDocument()
    })

    it("caveats the Retirement-Age FI headline gauge when off-track", () => {
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
      expect(
        screen.getByText(/125\.3% — based on the 4% rule/),
      ).toBeInTheDocument()
    })

    it("hides the numeric banner copy in privacy mode", () => {
      const { usePrivacyMode } = jest.requireMock("@hooks/usePrivacyMode")
      usePrivacyMode.mockReturnValueOnce({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(<ScenarioBar {...baseProps} pathToHorizon={offTrack} />)
      // Numeric levers must not leak when values are hidden.
      expect(screen.queryByText(/SGD1,800/)).not.toBeInTheDocument()
      expect(screen.queryByText(/To last to age 90/)).not.toBeInTheDocument()
    })
  })

  it("restores realReturn=null when slider returns within half a step of plan real", () => {
    // planRealReturn = 0.058 - 0.025 = 0.033. Start with a non-null override.
    const props = {
      ...baseProps,
      scenario: { ...baseScenario, realReturn: 0.05 },
    }
    render(<ScenarioBar {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Show sliders/ }))
    const realReturnSlider = screen
      .getByText("Real Return")
      .closest(".space-y-2")
      ?.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(realReturnSlider, { target: { value: "0.033" } })
    expect(props.onScenarioChange).toHaveBeenCalledWith({ realReturn: null })
  })
})
