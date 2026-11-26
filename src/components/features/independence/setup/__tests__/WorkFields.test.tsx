import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import WorkFields, { WorkFieldsProps } from "../WorkFields"

const noop = (): void => undefined

function renderFields(overrides: Partial<WorkFieldsProps> = {}): void {
  render(
    <WorkFields
      workingIncomeMonthly={5000}
      workingExpensesMonthly={3000}
      taxesMonthly={0}
      bonusMonthly={0}
      investmentAllocationPercent={100}
      currency="SGD"
      definedContributionMonthly={0}
      onWorkingIncomeMonthlyChange={noop}
      onWorkingExpensesMonthlyChange={noop}
      onTaxesMonthlyChange={noop}
      onBonusMonthlyChange={noop}
      onInvestmentAllocationPercentChange={noop}
      {...overrides}
    />,
  )
}

describe("WorkFields contribution preview", () => {
  it("invests the whole surplus when no defined contribution applies", () => {
    renderFields()

    expect(
      screen.getByText("Estimated monthly investment: SGD 2,000"),
    ).toBeInTheDocument()
  })

  it("takes the CPF employee share off gross pay before the preview", () => {
    // Gross 5,000 - expenses 3,000 - CPF employee 1,000 = 1,000 invested,
    // the figure svc-retire's projection uses (svc-retire #338).
    renderFields({ definedContributionMonthly: 1000 })

    expect(
      screen.getByText("Estimated monthly investment: SGD 1,000"),
    ).toBeInTheDocument()
    expect(screen.getByText(/after SGD 1,000 CPF/)).toBeInTheDocument()
  })

  it("labels the income as gross", () => {
    renderFields()

    expect(screen.getByText("Gross Monthly Income (SGD)")).toBeInTheDocument()
    expect(
      screen.getByText(/compulsory pension contributions/),
    ).toBeInTheDocument()
  })
})
