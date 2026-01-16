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

  it("renders Scenarios and Advanced tabs", () => {
    render(<WhatIfModal {...defaultProps} />)
    expect(screen.getByText("Scenarios")).toBeInTheDocument()
    expect(screen.getByText("Advanced")).toBeInTheDocument()
  })

  it("shows Scenarios tab content by default", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Scenarios tab should show expenses, working income, and projection sliders
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Working Income")).toBeInTheDocument()
    expect(screen.getByText("Salary")).toBeInTheDocument()
    expect(screen.getByText("Projection Scenarios")).toBeInTheDocument()
    expect(screen.getByText("Employment Investment")).toBeInTheDocument()
    expect(screen.getByText("Investment Returns")).toBeInTheDocument()
    expect(screen.getByText("Equity Allocation")).toBeInTheDocument()

    // Advanced content should not be visible
    expect(screen.queryByText("Independence Age")).not.toBeInTheDocument()
    expect(screen.queryByText("Inflation Rate")).not.toBeInTheDocument()
  })

  it("switches to Advanced tab when clicked", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Click Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    // Advanced tab should show timeline settings and independence income
    expect(screen.getByText("Timeline Settings")).toBeInTheDocument()
    expect(screen.getByText("Independence Age")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate")).toBeInTheDocument()
    expect(screen.getByText("Independence Income")).toBeInTheDocument()
    expect(screen.getByText("Pension")).toBeInTheDocument()
    expect(screen.getByText("Government Benefits")).toBeInTheDocument()
    expect(screen.getByText("Other Income")).toBeInTheDocument()

    // Scenarios content should not be visible
    expect(screen.queryByText("Projection Scenarios")).not.toBeInTheDocument()
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

  it("calls onAdjustmentsChange when expenses slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // First slider is Expenses on Scenarios tab
    fireEvent.change(sliders[0], { target: { value: "120" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      expensesPercent: 120,
    })
  })

  it("calls onScenarioOverridesChange when Salary slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // Slider order on Scenarios: Expenses(0), Salary(1), Investment(2), Returns(3), Equity(4)
    fireEvent.change(sliders[1], { target: { value: "10000" } })

    expect(defaultProps.onScenarioOverridesChange).toHaveBeenCalled()
    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    expect(updateFn({})).toEqual({ workingIncomeMonthly: 10000 })
  })

  it("shows monthly investment calculation on Scenarios tab", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(screen.getByText("Monthly Investment:")).toBeInTheDocument()
  })

  it("calls onAdjustmentsChange when Independence Age slider changes on Advanced tab", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    const sliders = screen.getAllByRole("slider")
    // Slider order on Advanced: IndependenceAge(0), Inflation(1), Pension(2), GovBenefits(3), OtherIncome(4)
    fireEvent.change(sliders[0], { target: { value: "2" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 2,
    })
  })

  it("calls onAdjustmentsChange when Inflation Rate slider changes on Advanced tab", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    const sliders = screen.getAllByRole("slider")
    // Slider order on Advanced: IndependenceAge(0), Inflation(1), Pension(2), GovBenefits(3), OtherIncome(4)
    fireEvent.change(sliders[1], { target: { value: "1" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      inflationOffset: 1,
    })
  })

  it("displays total independence income on Advanced tab", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    expect(screen.getByText("Total Independence Income:")).toBeInTheDocument()
  })

  it("calls onScenarioOverridesChange when Pension slider changes on Advanced tab", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    const sliders = screen.getAllByRole("slider")
    // Slider order on Advanced: IndependenceAge(0), Inflation(1), Pension(2), GovBenefits(3), OtherIncome(4)
    fireEvent.change(sliders[2], { target: { value: "1500" } })

    expect(defaultProps.onScenarioOverridesChange).toHaveBeenCalled()
    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    expect(updateFn({})).toEqual({ pensionMonthly: 1500 })
  })

  it("preserves existing overrides when updating a new field", () => {
    const propsWithExistingOverrides = {
      ...defaultProps,
      scenarioOverrides: { pensionMonthly: 2000 },
    }
    render(<WhatIfModal {...propsWithExistingOverrides} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    const sliders = screen.getAllByRole("slider")
    // Change Other Income slider (index 4)
    fireEvent.change(sliders[4], { target: { value: "500" } })

    const updateFn = defaultProps.onScenarioOverridesChange.mock.calls[0][0]
    // Verify functional update preserves existing values
    expect(updateFn({ pensionMonthly: 2000 })).toEqual({
      pensionMonthly: 2000,
      otherIncomeMonthly: 500,
    })
  })

  it("shows rental income when provided on Advanced tab", () => {
    const propsWithRental = {
      ...defaultProps,
      rentalIncome: {
        monthlyNetByCurrency: { NZD: 2000 },
        totalMonthlyInPlanCurrency: 2000,
      },
    }
    render(<WhatIfModal {...propsWithRental} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    expect(screen.getByText("Property Rental (read-only)")).toBeInTheDocument()
    expect(screen.getByText("$2,000/mo")).toBeInTheDocument()
    expect(screen.getByText("Configure in Accounts")).toBeInTheDocument()
  })

  it("does not show rental income section when no rental income", () => {
    render(<WhatIfModal {...defaultProps} />)

    // Switch to Advanced tab
    fireEvent.click(screen.getByText("Advanced"))

    expect(
      screen.queryByText("Property Rental (read-only)"),
    ).not.toBeInTheDocument()
  })

  it("shows indicator on Advanced tab when it has changes", () => {
    const propsWithAdvancedChanges = {
      ...defaultProps,
      scenarioOverrides: { pensionMonthly: 1500 },
    }
    render(<WhatIfModal {...propsWithAdvancedChanges} />)

    // The Advanced tab should have a dot indicator
    const advancedTab = screen.getByText("Advanced").closest("button")
    expect(advancedTab?.querySelector(".bg-orange-500")).toBeInTheDocument()
  })

  it("shows indicator on Advanced tab when independence age changes", () => {
    const propsWithAgeChange = {
      ...defaultProps,
      whatIfAdjustments: {
        ...DEFAULT_WHAT_IF_ADJUSTMENTS,
        retirementAgeOffset: 2,
      },
    }
    render(<WhatIfModal {...propsWithAgeChange} />)

    // The Advanced tab should have a dot indicator
    const advancedTab = screen.getByText("Advanced").closest("button")
    expect(advancedTab?.querySelector(".bg-orange-500")).toBeInTheDocument()
  })

  it("shows indicator on Advanced tab when inflation changes", () => {
    const propsWithInflationChange = {
      ...defaultProps,
      whatIfAdjustments: {
        ...DEFAULT_WHAT_IF_ADJUSTMENTS,
        inflationOffset: 1,
      },
    }
    render(<WhatIfModal {...propsWithInflationChange} />)

    // The Advanced tab should have a dot indicator
    const advancedTab = screen.getByText("Advanced").closest("button")
    expect(advancedTab?.querySelector(".bg-orange-500")).toBeInTheDocument()
  })
})
