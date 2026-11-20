import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { useWatchlist } from "@hooks/useWatchlist"
import {
  makeHoldingGroup,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"
import type { MoneyValues } from "types/beancounter"

jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))
jest.mock("@hooks/useWatchlist")

function renderRow(moneyValues: Partial<MoneyValues>): void {
  ;(useWatchlist as jest.Mock).mockReturnValue({ items: [] })
  render(
    <table>
      <Rows
        portfolio={makePortfolio({ id: "pf-irr" })}
        groupBy="Equity"
        holdingGroup={makeHoldingGroup({
          positions: [makePosition({ moneyValues })],
        })}
        valueIn={ValueIn.PORTFOLIO}
        onColumnsChange={jest.fn()}
        onPriceChart={jest.fn()}
      />
    </table>,
  )
}

describe("Rows IRR tooltip", () => {
  it("shows the lifetime IRR of a re-bought holding beside its lifetime ROI", () => {
    renderRow({ irr: -0.0237, roi: 0.16, lifetimeIrr: 0.21 })

    const tooltip = screen.getByTestId("irr-tooltip")
    expect(tooltip).toHaveTextContent("ROI: +16.00%")
    expect(tooltip).toHaveTextContent("Lifetime IRR: +21.00%")
  })

  it("shows a negative lifetime IRR with its sign", () => {
    renderRow({ irr: 0.05, roi: -0.1, lifetimeIrr: -0.08 })

    const tooltip = screen.getByTestId("irr-tooltip")
    expect(tooltip).toHaveTextContent("ROI: -10.00%")
    expect(tooltip).toHaveTextContent("Lifetime IRR: -8.00%")
  })

  it("omits the lifetime IRR when it matches the position IRR", () => {
    renderRow({ irr: 0.2, roi: 0.5, lifetimeIrr: 0.2 })

    expect(screen.getByTestId("irr-tooltip")).not.toHaveTextContent(
      "Lifetime IRR",
    )
  })
})
