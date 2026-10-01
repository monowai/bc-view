import React from "react"
import { render, screen, within } from "@testing-library/react"
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

jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/independence" }),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("../../useExpenseCategories", () => ({
  useExpenseCategories: () => ({ labels: [] }),
}))

jest.mock("../../useLifestyleCatalog", () => ({
  useLifestyleCatalog: () => ({ catalog: undefined }),
}))

jest.mock("../../usePlanExpenses", () => ({
  usePlanExpenses: (planId: string) => ({
    expenses: [
      {
        id: "e1",
        planId,
        categoryLabelId: "housing",
        categoryName: "Housing",
        monthlyAmount: 2_000,
        currency: "SGD",
        sortOrder: 0,
        expensePhase: "RETIREMENT",
      },
      {
        id: "e2",
        planId,
        categoryLabelId: "food",
        categoryName: "Food",
        monthlyAmount: 2_000,
        currency: "SGD",
        sortOrder: 1,
        expensePhase: "RETIREMENT",
      },
    ],
    isLoading: false,
  }),
}))

import PhaseSpendList from "../PhaseSpendList"

const row = (
  age: number,
  planId: string,
  expenses: number,
  pension: number,
): CompositeYearlyProjection => ({
  year: age - 60,
  age,
  planId,
  planName: planId,
  startingBalance: 0,
  investmentReturns: 0,
  income: pension,
  expenses,
  endingBalance: 0,
  nonSpendableValue: 0,
  totalWealth: 0,
  currency: "SGD",
  incomeBreakdown: {
    investmentReturns: 0,
    pension,
    socialSecurity: 0,
    otherIncome: 0,
    rentalIncome: 0,
    totalIncome: pension,
  },
})

function renderList(): void {
  const ctx = {
    displayCurrency: "SGD",
    isLoading: false,
    projection: {
      displayCurrency: "SGD",
      phases: [
        {
          planId: "go",
          planName: "Go-Go",
          fromAge: 62,
          toAge: 63,
          expensesCurrency: "SGD",
        },
        {
          planId: "slow",
          planName: "Slow Go",
          fromAge: 64,
          toAge: 64,
          expensesCurrency: "SGD",
        },
      ],
      yearlyProjections: [
        row(62, "go", 40_000, 10_000),
        row(63, "go", 60_000, 10_000),
        row(64, "slow", 90_000, 0),
      ],
      warnings: [],
    } as unknown as CompositeProjectionResult,
  } as CompositeProjectionValue

  render(
    <CompositeProjectionProvider value={ctx}>
      <PhaseSpendList />
    </CompositeProjectionProvider>,
  )
}

describe("PhaseSpendList typical year", () => {
  it("should show a stage's average year across its own years only, split by category", async () => {
    renderList()

    await userEvent.click(
      screen.getByRole("button", { name: /typical Go-Go year/i }),
    )

    expect(
      screen.getByRole("heading", { name: /typical year/ }),
    ).toHaveTextContent("Go-Go · typical year, age 62–63")
    const sources = screen.getByRole("list", { name: "Where it came from" })
    expect(sources).toHaveTextContent("PensionSGD 10,000")
    expect(sources).toHaveTextContent("From portfolio*SGD 40,000")
    const uses = screen.getByRole("list", { name: "Where it went" })
    expect(
      within(uses)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Living expensesSGD 50,000",
      "HousingSGD 25,000",
      "FoodSGD 25,000",
    ])
  })
})
