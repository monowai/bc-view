import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import AssetChart from "@components/features/assets/AssetChart"
import { makeAsset } from "@test-fixtures/beancounter"

// Each modal has its own tests; here they only report what they were opened with.
jest.mock("@components/features/fx/RateChartModal", () => {
  return function RateChartModal(props: {
    from: string
    to: string
    onClose: () => void
  }) {
    return (
      <button type="button" onClick={props.onClose}>
        {`rate chart ${props.from}/${props.to}`}
      </button>
    )
  }
})
jest.mock("@components/features/assets/PriceChartPopup", () => {
  return function PriceChartPopup(props: {
    asset: { code: string }
    portfolioId?: string
    onClose: () => void
  }) {
    return (
      <button type="button" onClick={props.onClose}>
        {`price chart ${props.asset.code} ${props.portfolioId ?? ""}`.trim()}
      </button>
    )
  }
})

describe("AssetChart", () => {
  it("opens the FX rate chart for a currency pair", () => {
    const onClose = jest.fn()
    render(
      <AssetChart
        asset={makeAsset({
          code: "NZDSGD",
          assetCategory: { id: "CURRENCY", name: "Currency" },
          market: { code: "FX", name: "FX" } as never,
        })}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByText("rate chart NZD/SGD"))
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByText(/price chart/)).not.toBeInTheDocument()
  })

  it("opens the price chart for any other asset, passing its props through", () => {
    render(
      <AssetChart
        asset={makeAsset({ code: "AAPL" })}
        portfolioId="pf-1"
        onClose={jest.fn()}
      />,
    )

    expect(screen.getByText("price chart AAPL pf-1")).toBeInTheDocument()
    expect(screen.queryByText(/rate chart/)).not.toBeInTheDocument()
  })
})
