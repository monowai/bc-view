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

  it("disables Reset and Save when not dirty", () => {
    render(<ScenarioBar {...baseProps} />)
    expect(screen.getByRole("button", { name: /Reset/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Save Scenario/ })).toBeDisabled()
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
