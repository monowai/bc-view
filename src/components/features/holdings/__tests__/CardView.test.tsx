import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CardView from "../CardView"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

describe("CardView footer (Quantity / Price / Weight)", () => {
  it("renders quantity, price, and weight values with their labels", () => {
    const portfolio = makePortfolio()
    const position = makePosition({
      moneyValues: { weight: 0.25 },
      price: 150,
      quantityValues: { total: 100 },
    })
    const holdings = makeHoldings({
      portfolio,
      holdingGroups: { Equity: makeHoldingGroup({ positions: [position] }) },
    })

    render(
      <CardView
        holdings={holdings}
        portfolio={portfolio}
        valueIn={ValueIn.PORTFOLIO}
      />,
    )

    expect(screen.getByText("Quantity")).toBeInTheDocument()
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Weight")).toBeInTheDocument()

    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("$150.00")).toBeInTheDocument()
    // Weight renders "25.00" inside a span followed by a sibling "%" text node
    const weightLabel = screen.getByText("Weight")
    expect(weightLabel.parentElement).toHaveTextContent("25.00%")
  })
})
