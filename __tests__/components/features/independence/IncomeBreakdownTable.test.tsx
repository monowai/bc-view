import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { IncomeBreakdownTable } from "@components/features/independence"
import { YearlyProjection, ValueBasis } from "types/independence"

function makeYear(overrides: Partial<YearlyProjection> = {}): YearlyProjection {
  return {
    year: 2030,
    age: 65,
    startingBalance: 100000,
    investment: 4000,
    withdrawals: 0,
    endingBalance: 104000,
    inflationAdjustedExpenses: 30000,
    currency: "SGD",
    nonSpendableValue: 0,
    totalWealth: 104000,
    incomeBreakdown: {
      investmentReturns: 4000,
      pension: 12000,
      socialSecurity: 6000,
      otherIncome: 0,
      rentalIncome: 0,
      totalIncome: 22000,
    },
    ...overrides,
  }
}

describe("IncomeBreakdownTable value basis", () => {
  it("shows the future dollars caption in plain language", () => {
    render(<IncomeBreakdownTable projections={[makeYear()]} />)
    expect(screen.getByText(/future dollars/i)).toBeInTheDocument()
  })

  it("tags pension as 'stays same' when the backend flag says it is not indexed", () => {
    const valueBasis: ValueBasis = {
      balanceBasis: "NOMINAL_FUTURE",
      incomeStreams: [
        { key: "pension", inflationIndexed: false },
        { key: "socialSecurity", inflationIndexed: true },
      ],
    }
    render(
      <IncomeBreakdownTable
        projections={[makeYear()]}
        valueBasis={valueBasis}
      />,
    )
    // Pension column header shows it stays the same each year.
    const pensionHeader = screen.getByText("Pension").closest("th")
    expect(pensionHeader).toHaveTextContent("stays same")
    // Govt Benefits column shows it rises with inflation.
    const govHeader = screen.getByText("Govt Benefits").closest("th")
    expect(govHeader).toHaveTextContent("rises")
  })

  it("falls back to defaults (pension stays same) when valueBasis is absent", () => {
    render(<IncomeBreakdownTable projections={[makeYear()]} />)
    const pensionHeader = screen.getByText("Pension").closest("th")
    expect(pensionHeader).toHaveTextContent("stays same")
  })
})
