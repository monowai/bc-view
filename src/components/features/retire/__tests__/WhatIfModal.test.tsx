import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import WhatIfModal from "../WhatIfModal"
import { DEFAULT_WHAT_IF_ADJUSTMENTS } from "../types"
import { RetirementPlan } from "types/retirement"

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
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    plan: mockPlan,
    whatIfAdjustments: DEFAULT_WHAT_IF_ADJUSTMENTS,
    onAdjustmentsChange: jest.fn(),
    onReset: jest.fn(),
    retirementAge: 65,
    monthlyInvestment: 1600,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(<WhatIfModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders dialog title when open", () => {
    render(<WhatIfModal {...defaultProps} />)
    expect(screen.getByText("What-If Analysis")).toBeInTheDocument()
  })

  it("renders all slider labels", () => {
    render(<WhatIfModal {...defaultProps} />)

    expect(screen.getByText("Retirement Age")).toBeInTheDocument()
    expect(screen.getByText("Employment Investment")).toBeInTheDocument()
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Investment Returns")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate")).toBeInTheDocument()
    expect(screen.getByText("Equity Allocation")).toBeInTheDocument()
  })

  it("calls onClose when Done button is clicked", () => {
    render(<WhatIfModal {...defaultProps} />)

    const doneButton = screen.getByText("Done")
    fireEvent.click(doneButton)

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

  it("calls onAdjustmentsChange when slider changes", () => {
    render(<WhatIfModal {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // First slider is Retirement Age
    fireEvent.change(sliders[0], { target: { value: "2" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 2,
    })
  })
})
