import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import AssumptionsPanel from "../AssumptionsPanel"
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
  jest.clearAllMocks()
})

describe("AssumptionsPanel", () => {
  it("renders all 9 slider labels", () => {
    render(<AssumptionsPanel {...baseProps} />)
    for (const label of [
      "Retirement Age",
      "Life Expectancy",
      "Liquid Assets",
      "Monthly Expenses",
      "Expected Real Return",
      "Government Benefits",
      "Other Income",
      "Inflation",
      "Cash → Investments",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("Real Return slider IS present (new in AssumptionsPanel, absent in old ScenarioBar)", () => {
    render(<AssumptionsPanel {...baseProps} />)
    expect(screen.getByText("Expected Real Return")).toBeInTheDocument()
  })

  it("shows the Assumptions title", () => {
    render(<AssumptionsPanel {...baseProps} />)
    expect(screen.getByText("Assumptions")).toBeInTheDocument()
  })

  it("shows 'adjusted' badge when isDirty", () => {
    render(<AssumptionsPanel {...baseProps} isDirty />)
    expect(screen.getByText("adjusted")).toBeInTheDocument()
  })

  it("does not show dirty badge when not dirty", () => {
    render(<AssumptionsPanel {...baseProps} />)
    expect(screen.queryByText("adjusted")).not.toBeInTheDocument()
  })

  it("Reset button is disabled when not dirty", () => {
    render(<AssumptionsPanel {...baseProps} />)
    expect(screen.getByRole("button", { name: /Reset/ })).toBeDisabled()
  })

  it("Save Scenario button is not shown when not dirty", () => {
    render(<AssumptionsPanel {...baseProps} />)
    expect(
      screen.queryByRole("button", { name: /Save Scenario/ }),
    ).not.toBeInTheDocument()
  })

  it("Save Scenario button appears when isDirty", () => {
    const { rerender } = render(<AssumptionsPanel {...baseProps} />)
    expect(
      screen.queryByRole("button", { name: /Save Scenario/ }),
    ).not.toBeInTheDocument()
    rerender(<AssumptionsPanel {...baseProps} isDirty />)
    expect(
      screen.getByRole("button", { name: /Save Scenario/ }),
    ).toBeInTheDocument()
  })

  it("calls onReset when Reset clicked while dirty", () => {
    render(<AssumptionsPanel {...baseProps} isDirty />)
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }))
    expect(baseProps.onReset).toHaveBeenCalledTimes(1)
  })

  it("calls onSave when Save Scenario clicked while dirty", () => {
    render(<AssumptionsPanel {...baseProps} isDirty />)
    fireEvent.click(screen.getByRole("button", { name: /Save Scenario/ }))
    expect(baseProps.onSave).toHaveBeenCalledTimes(1)
  })

  it("writes liquidAssets=number when slider moves away from derived value", () => {
    render(<AssumptionsPanel {...baseProps} />)
    const liquidSlider = screen
      .getByText("Liquid Assets")
      .closest(".space-y-2")
      ?.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(liquidSlider, { target: { value: "200000" } })
    expect(baseProps.onScenarioChange).toHaveBeenCalledWith({
      liquidAssets: 200000,
    })
  })

  it("restores liquidAssets=null when slider returns to derived value", () => {
    const props = {
      ...baseProps,
      scenario: { ...baseScenario, liquidAssets: 100_000 },
    }
    render(<AssumptionsPanel {...props} />)
    const liquidSlider = screen
      .getByText("Liquid Assets")
      .closest(".space-y-2")
      ?.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(liquidSlider, {
      target: { value: String(baseProps.derivedLiquidAssets) },
    })
    expect(props.onScenarioChange).toHaveBeenCalledWith({ liquidAssets: null })
  })

  it("renders StrategyGaugesStrip with FIRE Progress gauge", () => {
    render(<AssumptionsPanel {...baseProps} />)
    // buildGauges always includes the FIRE Progress gauge (value 0 when fiMetrics undefined)
    expect(screen.getByText("FIRE Progress")).toBeInTheDocument()
  })

  describe("Cash → Investments education line", () => {
    it("shows blended return at 0% shift — motivates moving cash to investments", () => {
      render(<AssumptionsPanel {...baseProps} />)
      // planCashAlloc=1.0: 100% cash at 1.5% → blended=1.5%, real=1.5%-2.5%=-1.0% (red)
      expect(screen.getByText(/Expected:/)).toBeInTheDocument()
      expect(screen.getByText(/-1\.0% real/)).toBeInTheDocument()
    })

    it("shows positive real return when cash is shifted to investments", () => {
      render(
        <AssumptionsPanel
          {...baseProps}
          scenario={{ ...baseScenario, cashToInvestPercent: 50 }}
        />,
      )
      // 50% shift: 0.5*1.5% + 0.5*7% = 4.25% blended, real=4.25%-2.5%=1.75% ≈ +1.8%
      expect(screen.getByText(/\+1\.8% real/)).toBeInTheDocument()
    })
  })

  describe("mobile collapsible behavior", () => {
    it("renders a toggle button for mobile collapse", () => {
      render(<AssumptionsPanel {...baseProps} />)
      expect(
        screen.getByRole("button", {
          name: /Show assumptions|Hide assumptions/i,
        }),
      ).toBeInTheDocument()
    })

    it("toggle button starts with aria-expanded=false (collapsed by default)", () => {
      render(<AssumptionsPanel {...baseProps} />)
      const toggleBtn = screen.getByRole("button", {
        name: /Show assumptions/i,
      })
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false")
    })

    it("clicking toggle changes aria-expanded to true", () => {
      render(<AssumptionsPanel {...baseProps} />)
      const toggleBtn = screen.getByRole("button", {
        name: /Show assumptions/i,
      })
      fireEvent.click(toggleBtn)
      const expandedBtn = screen.getByRole("button", {
        name: /Hide assumptions/i,
      })
      expect(expandedBtn).toHaveAttribute("aria-expanded", "true")
    })
  })
})
