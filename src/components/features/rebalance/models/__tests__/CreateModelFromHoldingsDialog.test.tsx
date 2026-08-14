import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import CreateModelFromHoldingsDialog from "../CreateModelFromHoldingsDialog"
import {
  makeHoldings,
  makeHoldingGroup,
  makePosition,
  makeAsset,
} from "@test-fixtures/beancounter"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe("CreateModelFromHoldingsDialog — typed weight-percent input", () => {
  function renderDialog(): void {
    const holdings = makeHoldings({
      holdingGroups: {
        Equity: makeHoldingGroup({
          positions: [
            makePosition({
              asset: makeAsset({ id: "a1", code: "AAPL" }),
              moneyValues: { marketValue: 10000 },
            }),
          ],
        }),
      },
    })
    render(
      <CreateModelFromHoldingsDialog
        modalOpen={true}
        onClose={jest.fn()}
        holdings={holdings}
        portfolioCode="TEST"
      />,
    )
  }

  it("clamps a typed value above 100 down to 100 instead of storing it verbatim", () => {
    renderDialog()
    const weightInput = screen.getByRole("spinbutton")
    expect(weightInput).toHaveValue(100)

    fireEvent.change(weightInput, { target: { value: "500" } })

    expect(weightInput).toHaveValue(100)
  })

  it("clamps a typed negative value up to 0", () => {
    renderDialog()
    const weightInput = screen.getByRole("spinbutton")

    fireEvent.change(weightInput, { target: { value: "-25" } })

    expect(weightInput).toHaveValue(0)
  })
})
