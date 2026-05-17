import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PhaseConfigList from "../PhaseConfigList"
import type { RetirementPlan, CompositePhase } from "types/independence"

function makePlan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  return {
    id: "plan-1",
    ownerId: "owner-1",
    name: "Test Plan",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    monthlyExpenses: 3000,
    expensesCurrency: "SGD",
    cashReturnRate: 0.02,
    equityReturnRate: 0.07,
    housingReturnRate: 0.03,
    inflationRate: 0.03,
    cashAllocation: 20,
    equityAllocation: 60,
    housingAllocation: 20,
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 80,
    isPrimary: false,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
    ...overrides,
  }
}

describe("PhaseConfigList", () => {
  const plans = [
    makePlan({ id: "p1", name: "Asia Plan" }),
    makePlan({ id: "p2", name: "Europe Plan" }),
  ]

  const phases: CompositePhase[] = [
    { planId: "p1", fromAge: 60, toAge: 75 },
    { planId: "p2", fromAge: 75 },
  ]

  const defaultProps = {
    plans,
    phases,
    onPhaseChange: jest.fn(),
    onExclude: jest.fn(),
    excludedPlanIds: new Set<string>(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders phase rows with plan names", () => {
    render(<PhaseConfigList {...defaultProps} />)

    // Plan names appear in both checkboxes and phase rows
    expect(screen.getAllByText("Asia Plan")).toHaveLength(2)
    expect(screen.getAllByText("Europe Plan")).toHaveLength(2)
  })

  it("renders phase numbers", () => {
    render(<PhaseConfigList {...defaultProps} />)

    expect(screen.getByText("Phase 1:")).toBeInTheDocument()
    expect(screen.getByText("Phase 2:")).toBeInTheDocument()
  })

  it("renders age inputs for each phase", () => {
    render(<PhaseConfigList {...defaultProps} />)

    const fromInputs = screen.getAllByLabelText(/from age/)
    expect(fromInputs).toHaveLength(2)
    expect(fromInputs[0]).toHaveValue(60)
    expect(fromInputs[1]).toHaveValue(75)
  })

  it("shows 'end' for last phase toAge", () => {
    render(<PhaseConfigList {...defaultProps} />)

    expect(screen.getByText("end")).toBeInTheDocument()
  })

  it("calls onPhaseChange when fromAge changes", () => {
    render(<PhaseConfigList {...defaultProps} />)

    const fromInputs = screen.getAllByLabelText(/from age/)
    fireEvent.change(fromInputs[1], { target: { value: "70" } })

    expect(defaultProps.onPhaseChange).toHaveBeenCalledWith([
      { planId: "p1", fromAge: 60, toAge: 70 },
      { planId: "p2", fromAge: 70 },
    ])
  })

  it("calls onPhaseChange when toAge changes", () => {
    render(<PhaseConfigList {...defaultProps} />)

    const toInputs = screen.getAllByLabelText(/to age/)
    fireEvent.change(toInputs[0], { target: { value: "70" } })

    expect(defaultProps.onPhaseChange).toHaveBeenCalledWith([
      { planId: "p1", fromAge: 60, toAge: 70 },
      { planId: "p2", fromAge: 70 },
    ])
  })

  it("renders plan checkboxes for inclusion/exclusion", () => {
    render(<PhaseConfigList {...defaultProps} />)

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeChecked()
  })

  it("shows excluded plan as unchecked with strikethrough", () => {
    render(
      <PhaseConfigList {...defaultProps} excludedPlanIds={new Set(["p2"])} />,
    )

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[1]).not.toBeChecked()
  })

  it("calls onExclude when checkbox toggled", () => {
    render(<PhaseConfigList {...defaultProps} />)

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])

    expect(defaultProps.onExclude).toHaveBeenCalledWith("p1")
  })

  it("renders move up/down buttons", () => {
    render(<PhaseConfigList {...defaultProps} />)

    expect(screen.getByLabelText("Move phase 1 up")).toBeDisabled()
    expect(screen.getByLabelText("Move phase 1 down")).not.toBeDisabled()
    expect(screen.getByLabelText("Move phase 2 up")).not.toBeDisabled()
    expect(screen.getByLabelText("Move phase 2 down")).toBeDisabled()
  })

  it("swaps plan IDs when move down is clicked", () => {
    render(<PhaseConfigList {...defaultProps} />)

    fireEvent.click(screen.getByLabelText("Move phase 1 down"))

    expect(defaultProps.onPhaseChange).toHaveBeenCalledWith([
      { planId: "p2", fromAge: 60, toAge: 75 },
      { planId: "p1", fromAge: 75 },
    ])
  })

  it("shows message when no phases", () => {
    render(<PhaseConfigList {...defaultProps} phases={[]} />)

    expect(
      screen.getByText("Select at least one plan to configure phases."),
    ).toBeInTheDocument()
  })

  it("renders duration for non-last phases", () => {
    render(<PhaseConfigList {...defaultProps} />)

    expect(screen.getByText("(15 yr)")).toBeInTheDocument()
  })
})
