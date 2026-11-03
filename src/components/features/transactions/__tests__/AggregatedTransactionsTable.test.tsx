import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AggregatedTransactionsTable from "../AggregatedTransactionsTable"
import type { AggregatedTransaction } from "types/proposed"

function agg(
  key: string,
  overrides: Partial<AggregatedTransaction> = {},
  statuses: string[] = ["PROPOSED"],
): AggregatedTransaction {
  const transactions = statuses.map((status, i) => ({
    id: `${key}-${i}`,
    status,
  })) as unknown as AggregatedTransaction["transactions"]
  return {
    aggregateKey: key,
    brokerId: "b1",
    brokerName: "Broker One",
    assetId: `asset-${key}`,
    assetCode: key,
    assetName: `${key} Corp`,
    assetMarket: { code: "US" },
    trnType: "BUY",
    tradeCurrency: { code: "USD" },
    totalQuantity: 100,
    avgPrice: 10,
    totalFees: 1.5,
    totalAmount: 750,
    transactionIds: transactions.map((t) => t.id),
    transactions,
    editedPrice: 10,
    editedStatus: "PROPOSED",
    editedTradeDate: "2026-01-02",
    ...overrides,
  }
}

function setup(
  rows: AggregatedTransaction[],
  selected: string[] = [],
  withChart = true,
): Record<string, jest.Mock> {
  const handlers = {
    onSelectAggregated: jest.fn(),
    onPriceChange: jest.fn(),
    onStatusChange: jest.fn(),
    onTradeDateChange: jest.fn(),
    onShowChart: jest.fn(),
  }
  render(
    <AggregatedTransactionsTable
      aggregatedTransactions={rows}
      selectedIds={new Set(selected)}
      {...handlers}
      onShowChart={withChart ? handlers.onShowChart : undefined}
    />,
  )
  return handlers
}

describe("AggregatedTransactionsTable", () => {
  it("shows weights, broker fallback and underlying transaction counts", () => {
    setup([
      agg("AAA", { totalAmount: 750 }),
      agg("BBB", { totalAmount: -250, trnType: "SELL", brokerName: "" }, [
        "PROPOSED",
        "SETTLED",
      ]),
      agg("CCC", { trnType: "DIVI", totalAmount: 750 }),
    ])
    expect(screen.getAllByText("42.9%")).toHaveLength(2)
    expect(screen.getByText("14.3%")).toBeVisible()
    expect(screen.getByText("--")).toBeVisible()
    expect(screen.getByTitle("2 underlying transactions")).toHaveTextContent(
      "2",
    )
  })

  it("reports zero weight when nothing has an amount", () => {
    setup([agg("AAA", { totalAmount: 0 })])
    expect(screen.getByText("0.0%")).toBeVisible()
  })

  it("selects a single aggregate", async () => {
    const user = userEvent.setup()
    const h = setup([agg("AAA"), agg("BBB")])
    const boxes = screen.getAllByTitle(/Select 1 transactions for bulk settle/)
    await user.click(boxes[1])
    expect(h.onSelectAggregated).toHaveBeenCalledWith("BBB", true)
  })

  it("disables selection once everything is settled", () => {
    setup([agg("AAA", {}, ["SETTLED"])])
    expect(screen.getByTitle("All transactions already settled")).toBeDisabled()
  })

  it("select-all applies only to aggregates with proposed transactions", async () => {
    const user = userEvent.setup()
    const h = setup([agg("AAA"), agg("DONE", {}, ["SETTLED"]), agg("BBB")])
    await user.click(screen.getByTitle("Select all PROPOSED transactions"))
    expect(h.onSelectAggregated).toHaveBeenCalledTimes(2)
    expect(h.onSelectAggregated).toHaveBeenCalledWith("AAA", true)
    expect(h.onSelectAggregated).toHaveBeenCalledWith("BBB", true)
  })

  it("reflects full and partial selection in the checkboxes", () => {
    setup(
      [agg("AAA", {}, ["PROPOSED", "PROPOSED"]), agg("BBB")],
      ["AAA-0", "BBB-0"],
    )
    const all = screen.getByTitle(
      "Select all PROPOSED transactions",
    ) as HTMLInputElement
    expect(all.checked).toBe(false)
    expect(all.indeterminate).toBe(true)
    const partial = screen.getByTitle(
      "Select 2 transactions for bulk settle",
    ) as HTMLInputElement
    expect(partial.indeterminate).toBe(true)
    const full = screen.getByTitle(
      "Select 1 transactions for bulk settle",
    ) as HTMLInputElement
    expect(full.checked).toBe(true)
  })

  it("edits price, status and trade date for the whole aggregate", async () => {
    const user = userEvent.setup()
    const h = setup([agg("AAA")])
    const row = screen.getAllByRole("row")[1]

    const price = within(row).getByTitle(/Editing price/)
    await user.clear(price)
    await user.type(price, "12.5")
    await user.tab()
    expect(h.onPriceChange).toHaveBeenLastCalledWith("AAA", 12.5)

    await user.click(within(row).getByTitle(/Changing status/))
    expect(h.onStatusChange).toHaveBeenCalledWith("AAA", "SETTLED")

    fireEvent.change(within(row).getByTitle(/Changing date/), {
      target: { value: "2026-03-04" },
    })
    expect(h.onTradeDateChange).toHaveBeenCalledWith("AAA", "2026-03-04")
  })

  it("unsettles when a settled aggregate is unchecked", async () => {
    const user = userEvent.setup()
    const h = setup([agg("AAA", { editedStatus: "SETTLED" })])
    await user.click(screen.getByTitle(/Changing status/))
    expect(h.onStatusChange).toHaveBeenCalledWith("AAA", "PROPOSED")
  })

  it("opens the price chart for the aggregate when supplied", async () => {
    const user = userEvent.setup()
    const rows = [agg("AAA")]
    const h = setup(rows)
    await user.click(screen.getByLabelText("Price chart for AAA"))
    expect(h.onShowChart).toHaveBeenCalledWith(rows[0])
  })

  it("omits the chart button without a handler", () => {
    setup([agg("AAA")], [], false)
    expect(screen.queryByLabelText("Price chart for AAA")).toBeNull()
  })
})
