import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import DetailedTransactionsTable from "../DetailedTransactionsTable"
import { ProposedTransaction } from "types/proposed"
import {
  makeAsset,
  makeCurrency,
  makePortfolio,
} from "@test-fixtures/beancounter"

function makeProposedTrn(
  overrides: Partial<ProposedTransaction> = {},
): ProposedTransaction {
  const asset = makeAsset({ id: "msft-id", code: "MSFT", name: "Microsoft" })
  return {
    id: "trn-1",
    trnType: "BUY",
    status: "PROPOSED",
    portfolio: makePortfolio({ id: "pf-1", code: "TEST" }),
    asset,
    tradeDate: "2026-07-16",
    quantity: 10,
    price: 400,
    tradeCurrency: makeCurrency(),
    fees: 0,
    editedPrice: 415,
    editedFees: 0,
    editedStatus: "PROPOSED",
    editedTradeDate: "2026-07-16",
    ...overrides,
  } as ProposedTransaction
}

const noopProps = {
  brokers: [],
  selectedIds: new Set<string>(),
  allProposedSelected: false,
  someProposedSelected: false,
  onSelectAll: jest.fn(),
  onSelectOne: jest.fn(),
  onPriceChange: jest.fn(),
  onFeesChange: jest.fn(),
  onStatusChange: jest.fn(),
  onTradeDateChange: jest.fn(),
  onBrokerChange: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
}

describe("DetailedTransactionsTable price chart button", () => {
  it("invokes onShowChart with the row when the chart icon is clicked", () => {
    const trn = makeProposedTrn()
    const onShowChart = jest.fn()

    render(
      <DetailedTransactionsTable
        {...noopProps}
        transactions={[trn]}
        onShowChart={onShowChart}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: /price chart for MSFT/i }),
    )
    expect(onShowChart).toHaveBeenCalledWith(trn)
  })

  it("omits the chart icon when no handler is supplied", () => {
    render(
      <DetailedTransactionsTable
        {...noopProps}
        transactions={[makeProposedTrn()]}
      />,
    )

    expect(
      screen.queryByRole("button", { name: /price chart/i }),
    ).not.toBeInTheDocument()
  })
})
