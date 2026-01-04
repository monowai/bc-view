import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScenarioSliders from "../ScenarioSliders"
import { WhatIfAdjustments, DEFAULT_WHAT_IF_ADJUSTMENTS } from "../types"
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

describe("ScenarioSliders", () => {
  const defaultProps = {
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

  it("renders all slider labels", () => {
    render(<ScenarioSliders {...defaultProps} />)

    expect(screen.getByText("What-If Analysis")).toBeInTheDocument()
    expect(screen.getByText("Retirement Age")).toBeInTheDocument()
    expect(screen.getByText("Employment Investment")).toBeInTheDocument()
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Investment Returns")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate")).toBeInTheDocument()
    expect(screen.getByText("Equity Allocation")).toBeInTheDocument()
  })

  it("renders reset button", () => {
    render(<ScenarioSliders {...defaultProps} />)

    expect(screen.getByText("Reset")).toBeInTheDocument()
  })

  it("calls onReset when reset button is clicked", () => {
    render(<ScenarioSliders {...defaultProps} />)

    const resetButton = screen.getByText("Reset")
    fireEvent.click(resetButton)

    expect(defaultProps.onReset).toHaveBeenCalled()
  })

  it("calls onAdjustmentsChange when slider changes", () => {
    render(<ScenarioSliders {...defaultProps} />)

    const sliders = screen.getAllByRole("slider")
    // First slider is Retirement Age
    fireEvent.change(sliders[0], { target: { value: "2" } })

    expect(defaultProps.onAdjustmentsChange).toHaveBeenCalledWith({
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 2,
    })
  })

  it("displays retirement age with offset", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 3,
    }
    render(
      <ScenarioSliders {...defaultProps} whatIfAdjustments={adjustments} />,
    )

    // Should show 65 + 3 = 68
    expect(screen.getByText("68 (+3)")).toBeInTheDocument()
  })

  it("displays monthly investment amount", () => {
    render(<ScenarioSliders {...defaultProps} />)

    // At 100%, should show $1,600/mo
    expect(screen.getByText("$1,600/mo (100%)")).toBeInTheDocument()
  })

  it("displays adjusted expenses percentage", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      expensesPercent: 120,
    }
    render(
      <ScenarioSliders {...defaultProps} whatIfAdjustments={adjustments} />,
    )

    // 120% of $5000 = $6000
    expect(screen.getByText("120% ($6,000)")).toBeInTheDocument()
  })

  it("displays equity allocation percentage", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      equityPercent: 70,
    }
    render(
      <ScenarioSliders {...defaultProps} whatIfAdjustments={adjustments} />,
    )

    expect(screen.getByText("70% Equity / 30% Cash")).toBeInTheDocument()
  })
})
