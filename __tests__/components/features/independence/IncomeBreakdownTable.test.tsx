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

// svc-retire #221: salary credited during working years flows into the
// backend's totalIncome, so it needs a column of its own — otherwise the
// visible components fall short of the Total Income beside them.
describe("IncomeBreakdownTable salary column", () => {
  const workingYear = makeYear({
    incomeBreakdown: {
      investmentReturns: 4000,
      pension: 0,
      socialSecurity: 0,
      otherIncome: 0,
      rentalIncome: 0,
      workingIncome: 60000,
      totalIncome: 64000,
    },
  })

  it("shows salary earned in a working year", () => {
    render(<IncomeBreakdownTable projections={[workingYear]} />)
    expect(screen.getByText("Salary")).toBeInTheDocument()
    expect(screen.getAllByText("$60,000").length).toBeGreaterThan(0)
  })

  it("reported components add up to the total income on the row", () => {
    render(<IncomeBreakdownTable projections={[workingYear]} />)
    // 4,000 investment + 60,000 salary — nothing unaccounted for.
    expect(screen.getAllByText("$64,000").length).toBeGreaterThan(0)
  })

  it("hides the column for a plan with no working years", () => {
    render(<IncomeBreakdownTable projections={[makeYear()]} />)
    expect(screen.queryByText("Salary")).not.toBeInTheDocument()
  })
})
