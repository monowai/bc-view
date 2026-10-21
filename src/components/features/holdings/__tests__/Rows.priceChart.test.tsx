import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import type { Asset } from "types/beancounter"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

// AlphaProgress depends on layout measurements that aren't useful here.
jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))

const portfolio = makePortfolio({ id: "pf-rows" })

function renderRow(
  asset: Asset,
  onPriceChart?: jest.Mock,
): ReturnType<typeof render> {
  const position = makePosition({
    asset,
    moneyValues: { weight: 0.25 },
    price: 150,
    quantityValues: { total: 100 },
  })
  return render(
    <table>
      <Rows
        portfolio={portfolio}
        groupBy="Equity"
        holdingGroup={makeHoldingGroup({ positions: [position] })}
        valueIn={ValueIn.PORTFOLIO}
        onColumnsChange={jest.fn()}
        onPriceChart={onPriceChart}
      />
    </table>,
  )
}

describe("Rows price chart icon", () => {
  it("shows a chart icon beside a chartable price that opens the chart", () => {
    const onPriceChart = jest.fn()
    renderRow(makeAsset(), onPriceChart)

    const icon = screen.getByRole("button", {
      name: "Open price chart for AAPL",
    })
    expect(icon).toHaveAttribute("title", "Open price chart")
    fireEvent.click(icon)
    expect(onPriceChart).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioId: portfolio.id }),
    )
  })

  it("keeps the price itself clickable", () => {
    const onPriceChart = jest.fn()
    renderRow(makeAsset(), onPriceChart)

    fireEvent.click(
      screen.getByRole("button", { name: /Show price chart for AAPL/i }),
    )
    expect(onPriceChart).toHaveBeenCalledTimes(1)
  })

  it("shows no chart icon for an unchartable asset", () => {
    renderRow(makeAsset({ chartable: false }), jest.fn())
    expect(
      screen.queryByRole("button", { name: /Open price chart/i }),
    ).not.toBeInTheDocument()
  })

  it("shows no chart icon for cash", () => {
    renderRow(makeCashAsset(), jest.fn())
    expect(
      screen.queryByRole("button", { name: /Open price chart/i }),
    ).not.toBeInTheDocument()
  })

  it("shows no chart icon without a chart handler", () => {
    renderRow(makeAsset())
    expect(
      screen.queryByRole("button", { name: /Open price chart/i }),
    ).not.toBeInTheDocument()
  })
})
