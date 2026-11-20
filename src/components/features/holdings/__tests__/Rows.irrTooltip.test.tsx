import React from "react"
import { render, screen, within } from "@testing-library/react"
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
  it("labels a re-bought holding's ROI and IRR as lifetime once", () => {
    renderRow({ irr: -0.0237, roi: 0.16, lifetimeIrr: 0.31 })

    const tooltip = screen.getByTestId("irr-tooltip")
    expect(within(tooltip).getAllByText("Lifetime")).toHaveLength(1)
    expect(within(tooltip).getByTestId("tooltip-roi")).toHaveTextContent(
      /^\+16\.00%$/,
    )
    expect(within(tooltip).getByTestId("tooltip-irr")).toHaveTextContent(
      /^\+31\.00%$/,
    )
  })

  it("shows negative lifetime returns with their sign", () => {
    renderRow({ irr: 0.05, roi: -0.1, lifetimeIrr: -0.08 })

    expect(screen.getByTestId("tooltip-roi")).toHaveTextContent(/^-10\.00%$/)
    expect(screen.getByTestId("tooltip-irr")).toHaveTextContent(/^-8\.00%$/)
  })

  it("shows only the ROI of a holding never sold out", () => {
    renderRow({ irr: 0.2, roi: 0.5, lifetimeIrr: 0.2 })

    const tooltip = screen.getByTestId("irr-tooltip")
    expect(tooltip).toHaveTextContent(/^ROI\s*\+50\.00%$/)
    expect(within(tooltip).queryByText("Lifetime")).not.toBeInTheDocument()
    expect(within(tooltip).queryByTestId("tooltip-irr")).not.toBeInTheDocument()
  })
})
