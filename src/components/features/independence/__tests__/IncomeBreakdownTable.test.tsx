import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type { YearlyProjection } from "types/independence"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

import IncomeBreakdownTable from "../IncomeBreakdownTable"

const year = (age: number): YearlyProjection => ({
  year: age,
  age,
  startingBalance: 100_000,
  investment: 5_000,
  withdrawals: 10_000,
  endingBalance: 95_000,
  inflationAdjustedExpenses: 30_000,
  currency: "USD",
  nonSpendableValue: 0,
  totalWealth: 95_000,
  incomeBreakdown: {
    investmentReturns: 5_000,
    pension: 20_000,
    socialSecurity: 0,
    otherIncome: 0,
    rentalIncome: 0,
    totalIncome: 25_000,
  },
})

describe("IncomeBreakdownTable year drill-down", () => {
  it("should offer the drill-down only on years the caller can explain", async () => {
    const onSelectYear = jest.fn()
    render(
      <IncomeBreakdownTable
        projections={[year(64), year(65)]}
        onSelectYear={onSelectYear}
        isYearSelectable={(p) => (p.age ?? 0) >= 65}
      />,
    )

    expect(
      screen.queryByRole("button", { name: /where the money goes at age 64/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: /where the money goes at age 65/i }),
    )
    expect(onSelectYear).toHaveBeenCalledWith(
      expect.objectContaining({ age: 65 }),
    )
  })

  it("should render plain ages when no drill-down is wired", () => {
    render(<IncomeBreakdownTable projections={[year(65)]} />)

    expect(
      screen.queryByRole("button", { name: /where the money goes/i }),
    ).not.toBeInTheDocument()
  })
})
