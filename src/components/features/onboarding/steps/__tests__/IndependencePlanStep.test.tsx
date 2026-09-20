import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependencePlanStep from "../IndependencePlanStep"

const baseProps = {
  enabled: false,
  yearOfBirth: 1981,
  monthOfBirth: 1,
  monthlyExpenses: 0,
  medicalExpenses: 0,
  targetRetirementAge: 65,
  workingIncomeMonthly: 0,
  workingExpensesMonthly: 0,
  taxesMonthly: 0,
  bonusMonthly: 0,
  investmentAllocationPercent: 50,
  onEnabledChange: jest.fn(),
  onYearOfBirthChange: jest.fn(),
  onMonthOfBirthChange: jest.fn(),
  onMonthlyExpensesChange: jest.fn(),
  onMedicalExpensesChange: jest.fn(),
  onTargetRetirementAgeChange: jest.fn(),
  onWorkingIncomeMonthlyChange: jest.fn(),
  onWorkingExpensesMonthlyChange: jest.fn(),
  onTaxesMonthlyChange: jest.fn(),
  onBonusMonthlyChange: jest.fn(),
  onInvestmentAllocationPercentChange: jest.fn(),
  baseCurrency: "SGD",
}

describe("IndependencePlanStep — CPF date-of-birth requirement", () => {
  it("shows DOB fields + a CPF message when the plan is skipped but a CPF pension requires it", () => {
    render(
      <IndependencePlanStep {...baseProps} enabled={false} cpfRequiresDob />,
    )

    expect(screen.getByLabelText("Year of birth")).toBeInTheDocument()
    expect(screen.getByLabelText("Month of birth")).toBeInTheDocument()
    expect(
      screen.getByText(/required to calculate your CPF contributions/i),
    ).toBeInTheDocument()
  })

  it("hides DOB fields when the plan is skipped and there is no CPF pension", () => {
    render(
      <IndependencePlanStep
        {...baseProps}
        enabled={false}
        cpfRequiresDob={false}
      />,
    )

    expect(screen.queryByLabelText("Year of birth")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/required to calculate your CPF contributions/i),
    ).not.toBeInTheDocument()
  })
})

describe("IndependencePlanStep — retirement expenses capture", () => {
  it("captures general and medical expenses as separate inputs", () => {
    const onMonthlyExpensesChange = jest.fn()
    const onMedicalExpensesChange = jest.fn()
    render(
      <IndependencePlanStep
        {...baseProps}
        enabled
        onMonthlyExpensesChange={onMonthlyExpensesChange}
        onMedicalExpensesChange={onMedicalExpensesChange}
      />,
    )

    fireEvent.change(screen.getByLabelText("Monthly retirement expenses"), {
      target: { value: "3000" },
    })
    fireEvent.change(screen.getByLabelText("Monthly medical expenses"), {
      target: { value: "300" },
    })

    expect(onMonthlyExpensesChange).toHaveBeenCalledWith(3000)
    expect(onMedicalExpensesChange).toHaveBeenCalledWith(300)
  })
})

describe("IndependencePlanStep — the user already has a journey", () => {
  it("names the existing plan, links to it, and offers no toggle", () => {
    render(
      <IndependencePlanStep
        {...baseProps}
        enabled={false}
        existingPlanCheck="found"
      />,
    )

    expect(
      screen.getByText(/you already have an independence plan/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/nothing to set up here/i)).toBeInTheDocument()

    const link = screen.getByRole("link", { name: /view it/i })
    expect(link).toHaveAttribute("href", "/independence")

    expect(
      screen.queryByRole("button", { name: /yes, let's do it/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /skip for now/i }),
    ).not.toBeInTheDocument()
    // The "you can create one anytime from the menu" consolation is wrong
    // here — they already have one.
    expect(
      screen.queryByText(/you can create an independence plan anytime/i),
    ).not.toBeInTheDocument()
  })

  it("still offers the toggle when there is no existing plan", () => {
    render(<IndependencePlanStep {...baseProps} enabled={false} />)

    expect(
      screen.getByRole("button", { name: /yes, let's do it/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/you already have an independence plan/i),
    ).not.toBeInTheDocument()
  })
})

describe("IndependencePlanStep — the existing-plan check hasn't answered", () => {
  it("shows a neutral placeholder while the check is in flight, not the toggle", () => {
    render(
      <IndependencePlanStep
        {...baseProps}
        enabled={false}
        existingPlanCheck="loading"
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      /checking your independence plan/i,
    )
    expect(
      screen.queryByRole("button", { name: /yes, let's do it/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /skip for now/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Target independence age"),
    ).not.toBeInTheDocument()
  })

  it("says so and points at the Independence page when the check failed", () => {
    render(
      <IndependencePlanStep
        {...baseProps}
        enabled={false}
        existingPlanCheck="error"
      />,
    )

    expect(
      screen.getByText(/couldn't check whether you already have/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /independence page/i }),
    ).toHaveAttribute("href", "/independence")
    expect(
      screen.queryByRole("button", { name: /yes, let's do it/i }),
    ).not.toBeInTheDocument()
  })
})
