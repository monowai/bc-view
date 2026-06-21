import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependencePlanStep from "../IndependencePlanStep"

const baseProps = {
  enabled: false,
  yearOfBirth: 1981,
  monthOfBirth: 1,
  monthlyExpenses: 0,
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
