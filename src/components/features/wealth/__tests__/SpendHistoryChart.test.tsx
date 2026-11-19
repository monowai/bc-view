import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import SpendHistoryChart from "../SpendHistoryChart"
import type { SpendEntry } from "types/independence"

jest.mock("recharts", () => {
  const Named = ({ name }: { name?: string }): React.ReactElement => (
    <div data-testid="series">{name}</div>
  )
  const Pass = ({
    children,
  }: {
    children?: React.ReactNode
  }): React.ReactElement => <div>{children}</div>
  return {
    ResponsiveContainer: Pass,
    ComposedChart: Pass,
    Bar: Named,
    Line: Named,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
  }
})

const entry = (
  month: string,
  categoryLabelId: string,
  categoryName: string,
  actual: number | null,
  projected: number | null = null,
): SpendEntry => ({
  month,
  categoryLabelId,
  categoryName,
  projected,
  actual,
  currency: "SGD",
})

const entries = [
  entry("2026-10", "housing", "Housing", 3400, 3000),
  entry("2026-10", "food", "Food", 1100),
  entry("2026-11", "housing", "Housing", 3000),
]
const budgets = { housing: 3000, food: 1200 }
const months = ["2026-10", "2026-11"]

const renderChart = (e: SpendEntry[] = entries): void => {
  render(
    <SpendHistoryChart
      entries={e}
      budgets={budgets}
      months={months}
      currencySymbol="S$"
    />,
  )
}

describe("SpendHistoryChart", () => {
  it("stacks a bar per category and draws budget and projected lines", () => {
    renderChart()
    const drawn = screen.getAllByTestId("series").map((s) => s.textContent)
    expect(drawn).toEqual(["Housing", "Food", "Budget", "Projected"])
  })

  it("names every series in a legend", () => {
    renderChart()
    const legend = screen.getByRole("list", { name: "Legend" })
    expect(within(legend).getByText("Housing")).toBeInTheDocument()
    expect(within(legend).getByText("Food")).toBeInTheDocument()
    expect(within(legend).getByText("Budget")).toBeInTheDocument()
    expect(within(legend).getByText("Projected")).toBeInTheDocument()
  })

  it("shows the months as a table on request", () => {
    renderChart()
    fireEvent.click(screen.getByRole("button", { name: "Show table" }))
    const row = screen.getByRole("row", { name: /Oct 2026/ })
    expect(row).toHaveTextContent("S$4,500")
    expect(row).toHaveTextContent("S$4,200")
    expect(row).toHaveTextContent("S$3,000")
    expect(row).toHaveTextContent("S$300")
  })

  it("says so when nothing has been recorded", () => {
    renderChart([])
    expect(screen.getByText("No spend recorded yet.")).toBeInTheDocument()
    expect(screen.queryAllByTestId("series")).toHaveLength(0)
  })
})
