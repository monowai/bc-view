import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditPlanDetailsModal from "../EditPlanDetailsModal"
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

describe("EditPlanDetailsModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    plan: mockPlan,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <EditPlanDetailsModal {...defaultProps} isOpen={false} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders dialog title when open", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Edit Plan Details")).toBeInTheDocument()
  })

  it("displays all form fields", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Pension (Monthly)")).toBeInTheDocument()
    expect(
      screen.getByText("Government Benefits (Monthly)"),
    ).toBeInTheDocument()
    expect(screen.getByText("Other Income (Monthly)")).toBeInTheDocument()
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Return Rates")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate (%)")).toBeInTheDocument()
    expect(screen.getByText("Target Balance (Optional)")).toBeInTheDocument()
  })

  it("initializes form with plan values", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[]
    // Pension
    expect(inputs[0]).toHaveValue(1000)
    // Government Benefits
    expect(inputs[1]).toHaveValue(500)
    // Other Income
    expect(inputs[2]).toHaveValue(200)
    // Monthly Expenses
    expect(inputs[3]).toHaveValue(5000)
    // Equity Return Rate (converted to %) - use closeTo for floating point
    expect(parseFloat(inputs[4].value)).toBeCloseTo(7, 1)
    // Cash Return Rate (converted to %)
    expect(parseFloat(inputs[5].value)).toBeCloseTo(3, 1)
    // Housing Return Rate (converted to %)
    expect(parseFloat(inputs[6].value)).toBeCloseTo(4, 1)
    // Inflation Rate (converted to %)
    expect(parseFloat(inputs[7].value)).toBeCloseTo(2.5, 1)
    // Target Balance
    expect(inputs[8]).toHaveValue(100000)
  })

  it("displays net monthly need calculation", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Net Monthly Need")).toBeInTheDocument()
    // $5000 - $1000 - $500 - $200 = $3,300
    expect(screen.getByText("$3,300")).toBeInTheDocument()
  })

  it("updates net monthly need when income changes", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    const pensionInput = screen.getAllByRole("spinbutton")[0]
    fireEvent.change(pensionInput, { target: { value: "2000" } })

    // $5000 - $2000 - $500 - $200 = $2,300
    expect(screen.getByText("$2,300")).toBeInTheDocument()
  })

  it("calls onClose when cancel button is clicked", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    const cancelButton = screen.getByText("Cancel")
    fireEvent.click(cancelButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onApply with updated values when apply is clicked", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // Change pension value
    const pensionInput = screen.getAllByRole("spinbutton")[0]
    fireEvent.change(pensionInput, { target: { value: "1500" } })

    // Click apply
    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      pensionMonthly: 1500,
      socialSecurityMonthly: 500,
      otherIncomeMonthly: 200,
      monthlyExpenses: 5000,
      equityReturnRate: 0.07, // Converted back to decimal
      cashReturnRate: 0.03,
      housingReturnRate: 0.04,
      inflationRate: 0.025,
      targetBalance: 100000,
    })
  })

  it("converts inflation rate from percentage to decimal on apply", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // Change inflation rate (index 7 now)
    const inflationInput = screen.getAllByRole("spinbutton")[7]
    fireEvent.change(inflationInput, { target: { value: "3.5" } })

    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        inflationRate: 0.035,
      }),
    )
  })

  it("sets targetBalance to undefined when empty", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // Clear target balance (index 8 now)
    const targetInput = screen.getAllByRole("spinbutton")[8]
    fireEvent.change(targetInput, { target: { value: "" } })

    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        targetBalance: undefined,
      }),
    )
  })

  it("shows description for target balance", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(
      screen.getByText("Minimum balance to maintain at end of life"),
    ).toBeInTheDocument()
  })

  it("shows note about saving scenarios", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(
      screen.getByText(/Changes will update the projection/),
    ).toBeInTheDocument()
  })

  it("reinitializes form when plan changes", () => {
    const { rerender } = render(<EditPlanDetailsModal {...defaultProps} />)

    const updatedPlan = {
      ...mockPlan,
      pensionMonthly: 2000,
    }

    rerender(<EditPlanDetailsModal {...defaultProps} plan={updatedPlan} />)

    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(2000)
  })
})
