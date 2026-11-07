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

// A figure's value: the <dd> that follows its <dt> label.
const figure = (label: string): HTMLElement =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement

describe("SummaryView", () => {
  it("leads with market value, naming the currency once", () => {
    renderSummary()
    const marketValue = figure("Market Value")
    expect(marketValue).toHaveTextContent("$10,000.00")
    expect(marketValue).toHaveTextContent("USD")
    expect(screen.queryByText(/ - USD$/)).toBeNull()
  })

  it("shows gain on day with a sign and a direction icon, not colour alone", () => {
    renderSummary()
    const gainOnDay = figure("Gain on Day")
    expect(gainOnDay).toHaveTextContent(/^\+\$70\.00/)
    expect(gainOnDay).toHaveClass("text-green-600")
    expect(gainOnDay.querySelector(".fa-caret-up")).not.toBeNull()
  })

  it("shows total gain, IRR and the detail figures", () => {
    renderSummary()
    expect(figure("Total Gain")).toHaveTextContent("+$1,500.00")
    expect(figure("IRR")).toHaveTextContent("+12.30%")
    const realised = figure("Realised Gain")
    expect(realised).toHaveTextContent("-$20.00")
    expect(realised).toHaveClass("text-red-600")
    expect(realised.querySelector(".fa-caret-down")).not.toBeNull()
    expect(figure("Unrealised Gain")).toHaveTextContent("+$1,520.00")
    expect(figure("Dividends")).toHaveTextContent("$40.00")
    expect(figure("Purchases")).toHaveTextContent("$8,000.00")
    expect(figure("Sales")).toHaveTextContent("$500.00")
  })

  it("lists each allocation group with weight, gain on day and IRR", () => {
    renderSummary()
    expect(
      screen.getByRole("columnheader", { name: "Gain on Day" }),
    ).toBeVisible()
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

  it("toggles a group from the keyboard and reports its state", async () => {
    const user = userEvent.setup()
    renderSummary()
    const cash = screen.getByRole("button", { name: "Cash" })
    expect(cash).toHaveAttribute("aria-pressed", "true")

    cash.focus()
    await user.keyboard("{Enter}")
    expect(cash).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Filtered Total")).toBeVisible()

    await user.keyboard(" ")
    expect(cash).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Total")).toBeVisible()
  })

  it("withholds the portfolio IRR from a filtered total it does not describe", async () => {
    const user = userEvent.setup()
    renderSummary()
    const footer = (): HTMLElement =>
      screen
        .getByText(/Total$/, { selector: "td" })
        .closest("tr") as HTMLElement
    expect(footer()).toHaveTextContent("+12.30%")

    await user.click(rowFor("Cash"))
    expect(footer()).not.toHaveTextContent("12.30%")
  })

  it("switches between table, bar and donut views", async () => {
    const user = userEvent.setup()
    renderSummary()
    const tableOnly = screen.getByRole("button", { name: "Table only" })
    expect(tableOnly).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByTestId("chart")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Bar chart" }))
    expect(screen.getByTestId("chart")).toBeInTheDocument()
    expect(tableOnly).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: "Donut chart" }))
    expect(screen.getByTestId("chart")).toBeInTheDocument()
    await user.click(tableOnly)
    expect(screen.queryByTestId("chart")).toBeNull()
  })
})
