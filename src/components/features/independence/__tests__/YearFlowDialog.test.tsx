import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type { IncomeBreakdown } from "types/independence"

// Recharts lays nothing out in JSDOM. Keep what the chart was asked to draw —
// node names and link count — so the suite can assert on the flow shape.
jest.mock("recharts", () => ({
  ResponsiveContainer: ({
    children,
  }: {
    children: React.ReactNode
  }): React.ReactElement => <div>{children}</div>,
  Sankey: ({
    data,
  }: {
    data: { nodes: { name: string }[]; links: unknown[] }
  }): React.ReactElement => (
    <div
      data-testid="sankey"
      data-nodes={data.nodes.map((n) => n.name).join("|")}
      data-links={data.links.length}
    />
  ),
  Tooltip: () => <div />,
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

import YearFlowDialog from "../YearFlowDialog"

function breakdown(overrides: Partial<IncomeBreakdown> = {}): IncomeBreakdown {
  return {
    investmentReturns: 0,
    pension: 0,
    socialSecurity: 0,
    otherIncome: 0,
    rentalIncome: 0,
    totalIncome: 0,
    ...overrides,
  }
}

describe("YearFlowDialog", () => {
  it("should show salary fanning out to expenses and surplus in a working year", () => {
    render(
      <YearFlowDialog
        age={45}
        stage="Working"
        currency="SGD"
        row={{
          expenses: 60_000,
          incomeBreakdown: breakdown({
            workingIncome: 120_000,
            investmentReturns: 30_000,
          }),
        }}
        onClose={jest.fn()}
      />,
    )

    expect(screen.getByText(/Age 45/)).toBeInTheDocument()
    expect(screen.getByText(/Working/)).toBeInTheDocument()

    const sources = screen.getByRole("list", { name: "Where it came from" })
    expect(within(sources).getByText("Salary")).toBeInTheDocument()
    expect(within(sources).getByText("SGD 120,000")).toBeInTheDocument()

    const uses = screen.getByRole("list", { name: "Where it went" })
    expect(within(uses).getByText("Living expenses")).toBeInTheDocument()
    expect(within(uses).getByText("Surplus to portfolio")).toBeInTheDocument()
    expect(within(uses).getAllByText("SGD 60,000")).toHaveLength(2)
    expect(screen.getByText(/balancing figure/i)).toBeInTheDocument()

    const chart = screen.getByTestId("sankey")
    expect(chart).toHaveAttribute(
      "data-nodes",
      "Salary|This year|Living expenses|Surplus to portfolio",
    )
    expect(chart).toHaveAttribute("data-links", "3")
  })

  it("should show pension and a portfolio withdrawal converging on expenses in a retirement year", () => {
    render(
      <YearFlowDialog
        age={70}
        stage="Retired"
        currency="USD"
        row={{
          inflationAdjustedExpenses: 80_000,
          incomeBreakdown: breakdown({
            pension: 20_000,
            socialSecurity: 25_000,
          }),
        }}
        onClose={jest.fn()}
      />,
    )

    const sources = screen.getByRole("list", { name: "Where it came from" })
    expect(within(sources).getByText("Pension")).toBeInTheDocument()
    expect(within(sources).getByText("Govt Benefits")).toBeInTheDocument()
    expect(within(sources).getByText("From portfolio")).toBeInTheDocument()
    expect(within(sources).getByText("USD 35,000")).toBeInTheDocument()

    const uses = screen.getByRole("list", { name: "Where it went" })
    expect(within(uses).getByText("USD 80,000")).toBeInTheDocument()
    expect(screen.getAllByText("USD 80,000 in total")).toHaveLength(1)
  })

  it("should flag an unfunded shortfall as a warning, not a negative flow", () => {
    render(
      <YearFlowDialog
        age={88}
        currency="USD"
        row={{ inflationAdjustedExpenses: 50_000, unfundedExpense: 50_000 }}
        onClose={jest.fn()}
      />,
    )

    const sources = screen.getByRole("list", { name: "Where it came from" })
    expect(within(sources).getByText("Unfunded shortfall")).toBeInTheDocument()
    expect(
      within(sources).queryByText("From portfolio"),
    ).not.toBeInTheDocument()
  })

  it("should say so when nothing moved in the year", () => {
    render(
      <YearFlowDialog
        age={60}
        currency="USD"
        row={{ expenses: 0 }}
        onClose={jest.fn()}
      />,
    )

    expect(screen.getByText(/No cash moved/)).toBeInTheDocument()
    expect(screen.queryByTestId("sankey")).not.toBeInTheDocument()
  })

  it("should close from the close button", async () => {
    const onClose = jest.fn()
    render(
      <YearFlowDialog
        age={60}
        currency="USD"
        row={{ expenses: 10_000 }}
        onClose={onClose}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalled()
  })
})
