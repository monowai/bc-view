import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import useSwr from "swr"
import { MonthlyIncomeResponse } from "types/beancounter"
import { makePortfolio } from "@test-fixtures/beancounter"
import IncomeView from "../IncomeView"
import { incomeSeries, OTHER_COLOR } from "../MonthlyIncomeChart"

jest.mock("swr")

const mockHoldingState = {
  groupBy: { value: "asset.assetCategory.name" },
  incomePeriod: 12,
  setIncomePeriod: jest.fn(),
  incomeLayout: "chart",
  setIncomeLayout: jest.fn(),
}

jest.mock("@lib/holdings/holdingState", () => ({
  useHoldingState: () => mockHoldingState,
}))

const MONTHS = ["2026-08", "2026-09", "2026-10"]

function group(
  groupKey: string,
  monthly: number[],
): MonthlyIncomeResponse["groups"][number] {
  const totalIncome = monthly.reduce((sum, income) => sum + income, 0)
  return {
    groupKey,
    totalIncome,
    monthlyData: MONTHS.map((yearMonth, i) => ({
      yearMonth,
      income: monthly[i],
    })),
    topContributors: [
      {
        assetId: `${groupKey}-1`,
        assetCode: `${groupKey}-CODE`,
        assetName: `${groupKey} name`,
        totalIncome,
      },
    ],
  }
}

function incomeResponse(
  groups: MonthlyIncomeResponse["groups"],
): MonthlyIncomeResponse {
  const totalIncome = groups.reduce((sum, g) => sum + g.totalIncome, 0)
  return {
    startMonth: "2026-08",
    endMonth: "2026-10",
    currency: "USD",
    totalIncome,
    groupBy: "assetClass",
    months: MONTHS.map((yearMonth, i) => ({
      yearMonth,
      income: groups.reduce((sum, g) => sum + g.monthlyData[i].income, 0),
    })),
    groups,
  }
}

const TWO_GROUPS = incomeResponse([
  group("Equity", [40, 0, 20]),
  group("ETF", [10, 25, 5]),
])

function renderWith(data: MonthlyIncomeResponse): void {
  ;(useSwr as jest.Mock).mockReturnValue({ data, isLoading: false })
  render(<IncomeView portfolio={makePortfolio()} />)
}

describe("IncomeView", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHoldingState.incomeLayout = "chart"
  })

  it("asks the backend for income in the portfolio's currency", () => {
    renderWith(TWO_GROUPS)

    const url = (useSwr as jest.Mock).mock.calls[0][0] as string
    expect(new URLSearchParams(url.split("?")[1]).get("currency")).toBe(
      makePortfolio().currency.code,
    )
  })

  it("leads with the total, monthly average and a month-named range", () => {
    renderWith(TWO_GROUPS)

    const headline = screen.getByTestId("income-headline")
    expect(within(headline).getByText("Aug 26 to Oct 26")).toBeInTheDocument()
    expect(headline).toHaveTextContent("100.00")
    expect(headline).toHaveTextContent("33.33")
  })

  it("shows the ledger with every group's share in the chart layout", () => {
    renderWith(TWO_GROUPS)

    const ledger = screen.getByRole("table", { name: "Income by Asset Class" })
    expect(within(ledger).getByText("Equity")).toBeInTheDocument()
    expect(within(ledger).getByText("60.0%")).toBeInTheDocument()
    expect(within(ledger).getByText("40.0%")).toBeInTheDocument()
    expect(
      screen.queryByRole("table", { name: "Income calendar" }),
    ).not.toBeInTheDocument()
  })

  it("offers both layouts and records the choice", () => {
    renderWith(TWO_GROUPS)

    const choice = screen.getByRole("group", { name: "Layout" })
    expect(
      within(choice).getByRole("button", { name: "Chart" }),
    ).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(within(choice).getByRole("button", { name: "Calendar" }))
    expect(mockHoldingState.setIncomeLayout).toHaveBeenCalledWith("calendar")
  })

  it("renders groups by months with backend month totals in the calendar", () => {
    mockHoldingState.incomeLayout = "calendar"
    renderWith(TWO_GROUPS)

    const calendar = screen.getByRole("table", { name: "Income calendar" })
    expect(
      within(calendar).getByRole("columnheader", { name: "Oct 26" }),
    ).toBeInTheDocument()

    const equity = within(calendar).getByRole("row", { name: /^Equity/ })
    const cells = within(equity).getAllByRole("cell")
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "40",
      "·",
      "20",
      expect.stringContaining("60.00"),
    ])

    const totals = within(calendar).getByRole("row", { name: /^Month total/ })
    expect(
      within(totals)
        .getAllByRole("cell")
        .slice(0, 3)
        .map((cell) => cell.textContent),
    ).toEqual(["50", "25", "25"])
    expect(
      screen.queryByRole("table", { name: "Income by Asset Class" }),
    ).not.toBeInTheDocument()
  })

  it.each(["chart", "calendar"])(
    "expands contributors inline in the %s layout, without a dialog",
    (layout) => {
      mockHoldingState.incomeLayout = layout
      renderWith(TWO_GROUPS)

      const toggle = screen.getByRole("button", { name: "ETF" })
      expect(toggle).toHaveAttribute("aria-expanded", "false")

      fireEvent.click(toggle)
      expect(screen.getByText("ETF-CODE")).toBeInTheDocument()
      expect(toggle).toHaveAttribute("aria-expanded", "true")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

      fireEvent.click(toggle)
      expect(screen.queryByText("ETF-CODE")).not.toBeInTheDocument()
    },
  )

  it("changes the period from the headline", () => {
    renderWith(TWO_GROUPS)

    fireEvent.click(screen.getByRole("button", { name: "24m" }))
    expect(mockHoldingState.setIncomePeriod).toHaveBeenCalledWith(24)
  })

  it("explains an empty period instead of drawing empty tables", () => {
    renderWith(incomeResponse([]))

    expect(screen.getByText("No income in this period")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})

describe("incomeSeries", () => {
  const groups = Array.from({ length: 11 }, (_, i) =>
    group(`Group ${i}`, [11 - i, 0, 0]),
  )

  it("keeps small sets whole so nothing hides behind Other", () => {
    const series = incomeSeries(incomeResponse(groups.slice(0, 6)))
    expect(series).toHaveLength(6)
    expect(series.map((s) => s.key)).not.toContain("Other (1)")
  })

  it("folds the tail into one grey Other that adds up", () => {
    const series = incomeSeries(incomeResponse(groups))

    expect(series.map((s) => s.key)).toEqual([
      "Group 0",
      "Group 1",
      "Group 2",
      "Group 3",
      "Group 4",
      "Other (6)",
    ])
    const other = series[5]
    expect(other.color).toBe(OTHER_COLOR)
    expect(other.members).toContain("Group 10")
    expect(other.monthly[0]).toBe(21)
  })

  it("never gives two visible series one colour", () => {
    const colors = incomeSeries(incomeResponse(groups)).map((s) => s.color)
    expect(new Set(colors).size).toBe(colors.length)
  })
})
