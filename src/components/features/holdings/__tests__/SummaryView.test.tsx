import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SummaryView from "../SummaryView"
import { makeHoldings } from "@test-fixtures/beancounter"
import type { AllocationSlice } from "@lib/allocation/aggregateHoldings"

jest.mock("@lib/hooks/useDisplayCurrencyConversion", () => ({
  useDisplayCurrencyConversion: () => ({
    convert: (v: number) => v,
    currencySymbol: "$",
    currencyCode: "USD",
  }),
}))

// jsdom has no layout, so give the responsive container a real size.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="chart" style={{ width: 400, height: 200 }}>
        {React.cloneElement(
          children as React.ReactElement<object>,
          {
            width: 400,
            height: 200,
          } as object,
        )}
      </div>
    ),
  }
})

const slice = (
  key: string,
  value: number,
  gainOnDay: number,
  irr: number,
): AllocationSlice => ({
  key,
  label: key,
  value,
  percentage: 0,
  color: "#000",
  gainOnDay,
  irr,
})

const allocation = [
  slice("Cash", 2000, -50, 0),
  slice("Equity", 6000, 120, 0.2),
  slice("ETF", 2000, 0, -0.05),
]

function renderSummary(
  groupBy: "asset" | string = "Asset Classification",
): void {
  render(
    <SummaryView
      holdings={makeHoldings({
        viewTotals: {
          marketValue: 10000,
          gainOnDay: 70,
          totalGain: 1500,
          dividends: 40,
          purchases: 8000,
          sales: 500,
          realisedGain: -20,
          unrealisedGain: 1520,
        },
        totals: { irr: 0.123 },
      })}
      allocationData={allocation}
      groupBy={groupBy as never}
    />,
  )
}

const rowFor = (label: string): HTMLElement =>
  screen.getByText(label, { selector: "td span" }).closest("tr") as HTMLElement

describe("SummaryView", () => {
  it("shows the key metrics with signs and the portfolio IRR", () => {
    renderSummary()
    expect(screen.getByText("Market Value - USD")).toBeVisible()
    expect(screen.getByText("Unrealised Gain - USD")).toBeVisible()
    expect(
      screen.getByText("IRR", { selector: "p" }).nextElementSibling,
    ).toHaveTextContent("+12.30%")
    const gainOnDay = screen.getByText("Gain on Day").nextElementSibling
    expect(gainOnDay).toHaveTextContent(/^\+\$70/)
    expect(gainOnDay).toHaveClass("text-green-600")
    const realised = screen.getByText("Realised Gain").nextElementSibling
    expect(realised).toHaveClass("text-red-600")
    expect(screen.getByText("Dividends")).toBeVisible()
    expect(screen.getByText("Purchases")).toBeVisible()
    expect(screen.getByText("Sales")).toBeVisible()
  })

  it("lists each allocation group with weight, change and IRR", () => {
    renderSummary()
    const equity = rowFor("Equity")
    expect(within(equity).getByText("60.0%")).toBeVisible()
    expect(within(equity).getByText("+20.00%")).toBeVisible()
    expect(equity).toHaveTextContent("+$120")
    const etf = rowFor("ETF")
    expect(within(etf).getByText("-5.00%")).toBeVisible()
    expect(within(rowFor("Cash")).getByText("0.00%")).toBeVisible()
    expect(screen.getByText("Total")).toBeVisible()
    expect(screen.getByText("100%")).toBeVisible()
  })

  it("excludes a group from the filtered total when its row is clicked, and restores it", async () => {
    const user = userEvent.setup()
    renderSummary()
    await user.click(rowFor("Cash"))
    expect(screen.getByText("Filtered Total")).toBeVisible()
    expect(within(rowFor("Cash")).getByText("-")).toBeVisible()
    // remaining 8000: equity is now 75%
    expect(within(rowFor("Equity")).getByText("75.0%")).toBeVisible()

    await user.click(rowFor("Cash"))
    expect(screen.getByText("Total")).toBeVisible()
    expect(within(rowFor("Equity")).getByText("60.0%")).toBeVisible()
  })

  it("switches between table, bar and donut views", async () => {
    const user = userEvent.setup()
    renderSummary()
    expect(screen.queryByTestId("chart")).toBeNull()
    await user.click(screen.getByTitle("Bar chart"))
    expect(screen.getByTestId("chart")).toBeInTheDocument()
    await user.click(screen.getByTitle("Donut chart"))
    expect(screen.getByTestId("chart")).toBeInTheDocument()
    await user.click(screen.getByTitle("Table only"))
    expect(screen.queryByTestId("chart")).toBeNull()
  })
})
