import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ModelWeightsEditor from "../ModelWeightsEditor"
import { AssetWeightWithDetails } from "types/rebalance"

void React

function sampleWeight(
  overrides: Partial<AssetWeightWithDetails> = {},
): AssetWeightWithDetails {
  return {
    assetId: "PuEcMsbjRnalL6GBs4O6YA",
    assetCode: "US:VOO",
    assetName: "VANGUARD 500 INDEX FUND ETF SHARES",
    weight: 100,
    sortOrder: 0,
    ...overrides,
  }
}

describe("ModelWeightsEditor — Fetch Prices click", () => {
  it("invokes onFetchPrices with NO arguments (does not forward the click event)", () => {
    // Regression: the button used to render as `onClick={onFetchPrices}` which
    // forwarded the React SyntheticEvent as `weightsOverride` to the consumer's
    // handler. The handler then called .filter() on the event, threw TypeError,
    // and the surrounding try/catch swallowed it — no /prices request was fired.
    const onFetchPrices = jest.fn<void, []>()

    render(
      <ModelWeightsEditor
        weights={[sampleWeight()]}
        onChange={() => {}}
        onFetchPrices={onFetchPrices}
        showPrice
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /fetch prices/i }))

    expect(onFetchPrices).toHaveBeenCalledTimes(1)
    expect(onFetchPrices).toHaveBeenCalledWith()
    // Defensive: ensure the first call argument is undefined (not an event).
    expect(onFetchPrices.mock.calls[0]).toEqual([])
  })

  it("hides the Fetch Prices button while a fetch is in flight (disabled state)", () => {
    const onFetchPrices = jest.fn()

    render(
      <ModelWeightsEditor
        weights={[sampleWeight()]}
        onChange={() => {}}
        onFetchPrices={onFetchPrices}
        fetchingPrices
        showPrice
      />,
    )

    const button = screen.getByRole("button", { name: /fetch prices/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onFetchPrices).not.toHaveBeenCalled()
  })
})
