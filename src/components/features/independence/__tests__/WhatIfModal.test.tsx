import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import WhatIfModal from "../WhatIfModal"
import { DEFAULT_WHAT_IF_ADJUSTMENTS, ScenarioOverrides } from "../types"
import { RetirementPlan } from "types/independence"

const mockPlan: RetirementPlan = {
  id: "test-plan-1",
  name: "Test Plan",
  yearOfBirth: 1980,
  lifeExpectancy: 90,
  planningHorizonYears: 25,
  monthlyExpenses: 5000,
  expensesCurrency: "NZD",
  pensionMonthly: 1000,
  socialSecurityMonthly: 500,
  otherIncomeMonthly: 200,
  workingIncomeMonthly: 8000,
  workingExpensesMonthly: 6000,
  investmentAllocationPercent: 0.8,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.5,
  housingAllocation: 0.2,
  targetBalance: 100000,
  ownerId: "test-owner",
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

describe("WhatIfModal", () => {
  const defaultScenarioOverrides: ScenarioOverrides = {}

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    plan: mockPlan,
    whatIfAdjustments: DEFAULT_WHAT_IF_ADJUSTMENTS,
    onAdjustmentsChange: jest.fn(),
    scenarioOverrides: defaultScenarioOverrides,
    onScenarioOverridesChange: jest.fn(),
    onReset: jest.fn(),
    retirementAge: 65,
    monthlyInvestment: 1600,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <WhatIfModal {...defaultProps} isOpen={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders dialog title when open", () => {
    render(<WhatIfModal {...defaultProps} />)
    expect(screen.getByText("What-If Analysis")).toBeInTheDocument()
  })

  it("renders all slider labels", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(screen.getByText("Independence Age")).toBeInTheDocument()
    expect(screen.getByText("Employment Investment")).toBeInTheDocument()
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Investment Returns")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate")).toBeInTheDocument()
    expect(screen.getByText("Equity Allocation")).toBeInTheDocument()
  })

  it("calls onClose when Apply button is clicked", () => {
    render(<WhatIfModal {...defaultProps} />)

    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onClose when X button is clicked", () => {
    render(<WhatIfModal {...defaultProps} />)

    const closeButton = screen.getByRole("button", { name: "" })
    fireEvent.click(closeButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onReset when Reset button is clicked", () => {
    render(<WhatIfModal {...defaultProps} />)

    const resetButton = screen.getByText("Reset")
    fireEvent.click(resetButton)

    expect(defaultProps.onReset).toHaveBeenCalled()
  })

  it("calls onAdjustmentsChange when scenario slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // Find the Independence Age slider (in Scenario Adjustments section)
    // Income sliders come first: Pension, Government Benefits, Other Income (3)
    // Then Scenario sliders: Independence Age is first
    fireEvent.change(sliders[3], { target: { value: "2" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 2,
    })
  })

  it("renders income section with all income labels", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(screen.getByText("Monthly Income")).toBeInTheDocument()
    expect(screen.getByText("Pension")).toBeInTheDocument()
    expect(screen.getByText("Government Benefits")).toBeInTheDocument()
    expect(screen.getByText("Other Income")).toBeInTheDocument()
  })

  it("displays total income summary", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(screen.getByText("Total Income:")).toBeInTheDocument()
  })

  it("calls onScenarioOverridesChange when Pension slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // First slider is Pension
    fireEvent.change(sliders[0], { target: { value: "1500" } })

    expect(defaultProps.onScenarioOverridesChange).toHaveBeenCalled()
    // Verify functional update produces correct result
    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    expect(updateFn({})).toEqual({ pensionMonthly: 1500 })
  })

  it("calls onScenarioOverridesChange when Government Benefits slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // Second slider is Government Benefits
    fireEvent.change(sliders[1], { target: { value: "800" } })

    expect(defaultProps.onScenarioOverridesChange).toHaveBeenCalled()
    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    expect(updateFn({})).toEqual({ socialSecurityMonthly: 800 })
  })

  it("calls onScenarioOverridesChange when Other Income slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // Third slider is Other Income
    fireEvent.change(sliders[2], { target: { value: "1000" } })

    expect(defaultProps.onScenarioOverridesChange).toHaveBeenCalled()
    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    expect(updateFn({})).toEqual({ otherIncomeMonthly: 1000 })
  })

  it("preserves existing overrides when updating a new field", () => {
    const propsWithExistingOverrides = {
      ...defaultProps,
      scenarioOverrides: { pensionMonthly: 2000 },
    }
    render(<WhatIfModal {...propsWithExistingOverrides} />)

    const sliders = screen.getAllByRole("slider")
    // Change Other Income slider
    fireEvent.change(sliders[2], { target: { value: "500" } })

    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    // Verify functional update preserves existing values
    expect(updateFn({ pensionMonthly: 2000 })).toEqual({
      pensionMonthly: 2000,
      otherIncomeMonthly: 500,
    })
  })

  it("shows rental income when provided", () => {
    const propsWithRental = {
      ...defaultProps,
      rentalIncome: {
        monthlyNetByCurrency: { NZD: 2000 },
        totalMonthlyInPlanCurrency: 2000,
      },
    }
    render(<WhatIfModal {...propsWithRental} />)

    expect(screen.getByText("Property Rental (read-only)")).toBeInTheDocument()
    expect(screen.getByText("$2,000/mo")).toBeInTheDocument()
    expect(screen.getByText("Configure in Accounts")).toBeInTheDocument()
  })

  it("does not show rental income section when no rental income", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(
      screen.queryByText("Property Rental (read-only)"),
    ).not.toBeInTheDocument()
  })
})
