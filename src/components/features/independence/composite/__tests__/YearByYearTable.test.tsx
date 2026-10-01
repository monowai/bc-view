import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type {
  CompositeProjectionResult,
  CompositeYearlyProjection,
} from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

jest.mock("recharts", () => ({
  ResponsiveContainer: ({
    children,
  }: {
    children: React.ReactNode
  }): React.ReactElement => <div>{children}</div>,
  Sankey: () => <div data-testid="sankey" />,
  Tooltip: () => <div />,
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("../../usePlanExpenses", () => ({
  usePlanExpenses: (planId: string | undefined) => ({
    expenses:
      planId === "Slow-go years"
        ? [
            {
              id: "e1",
              planId,
              categoryLabelId: "housing",
              categoryName: "Housing",
              monthlyAmount: 3_000,
              currency: "SGD",
              sortOrder: 0,
            },
            {
              id: "e2",
              planId,
              categoryLabelId: "travel",
              categoryName: "Travel",
              monthlyAmount: 1_000,
              currency: "SGD",
              sortOrder: 1,
            },
          ]
        : undefined,
    isLoading: false,
  }),
}))

import YearByYearTable from "../YearByYearTable"

const row = (
  age: number,
  planName: string,
  pension: number,
): CompositeYearlyProjection => ({
  year: age - 60,
  age,
  planId: planName,
  planName,
  startingBalance: 500_000,
  investmentReturns: 20_000,
  income: pension,
  expenses: 50_000,
  endingBalance: 480_000,
  nonSpendableValue: 0,
  totalWealth: 480_000,
  currency: "SGD",
  incomeBreakdown: {
    investmentReturns: 20_000,
    pension,
    socialSecurity: 0,
    otherIncome: 0,
    rentalIncome: 0,
    totalIncome: pension + 20_000,
  },
})

function renderTable(): void {
  const ctx = {
    displayCurrency: "SGD",
    projection: {
      displayCurrency: "SGD",
      phases: [],
      yearlyProjections: [
        row(61, "Go-go years", 10_000),
        row(62, "Go-go years", 10_000),
        row(75, "Slow-go years", 30_000),
      ],
      warnings: [],
    } as unknown as CompositeProjectionResult,
  } as CompositeProjectionValue

  render(
    <CompositeProjectionProvider value={ctx}>
      <YearByYearTable />
    </CompositeProjectionProvider>,
  )
}

describe("YearByYearTable year drill-down", () => {
  it("should open the year's sources and uses with its stage when a year is chosen", async () => {
    renderTable()

    await userEvent.click(
      screen.getByRole("button", { name: /where the money goes at age 75/i }),
    )

    expect(screen.getByRole("heading", { name: /Age 75/ })).toHaveTextContent(
      "Slow-go years",
    )
    const sources = screen.getByRole("list", { name: "Where it came from" })
    expect(sources).toHaveTextContent("Pension")
    expect(sources).toHaveTextContent("SGD 30,000")
    expect(sources).toHaveTextContent("From portfolio")
    expect(sources).toHaveTextContent("SGD 20,000")
  })

  it("should split the year's living expenses across that stage's categories", async () => {
    renderTable()

    await userEvent.click(
      screen.getByRole("button", { name: /where the money goes at age 75/i }),
    )

    const uses = screen.getByRole("list", { name: "Where it went" })
    expect(uses).toHaveTextContent("HousingSGD 37,500")
    expect(uses).toHaveTextContent("TravelSGD 12,500")
  })

  it("should close the drill-down", async () => {
    renderTable()

    await userEvent.click(
      screen.getByRole("button", { name: /where the money goes at age 61/i }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(screen.queryByTestId("sankey")).not.toBeInTheDocument()
  })
})
