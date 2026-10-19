import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import AssetReviewButton from "../AssetReviewButton"
import { makeAsset, makeCashAsset } from "@test-fixtures/beancounter"

let mockPermissions = { ai: true, preview: false }
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ...mockPermissions,
    admin: false,
    isLoading: false,
  }),
}))

beforeEach(() => {
  mockPermissions = { ai: true, preview: false }
})

describe("AssetReviewButton", () => {
  it("opens the review for a listed asset", () => {
    const onShow = jest.fn()
    render(<AssetReviewButton asset={makeAsset()} onShow={onShow} />)

    fireEvent.click(screen.getByRole("button", { name: "AI review AAPL" }))

    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it("shows for a currency pair on the FX market", () => {
    const pair = makeAsset({
      code: "NZDSGD",
      assetCategory: { id: "CURRENCY", name: "Currency" },
      market: { code: "FX", name: "FX", currency: undefined as never },
    })
    render(<AssetReviewButton asset={pair} onShow={jest.fn()} />)

    expect(
      screen.getByRole("button", { name: "AI review NZDSGD" }),
    ).toBeInTheDocument()
  })

  it("shows for preview access", () => {
    mockPermissions = { ai: false, preview: true }
    render(<AssetReviewButton asset={makeAsset()} onShow={jest.fn()} />)

    expect(
      screen.getByRole("button", { name: /AI review/ }),
    ).toBeInTheDocument()
  })

  it("is hidden without AI or preview access", () => {
    mockPermissions = { ai: false, preview: false }
    const { container } = render(
      <AssetReviewButton asset={makeAsset()} onShow={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("is hidden for cash", () => {
    const { container } = render(
      <AssetReviewButton asset={makeCashAsset()} onShow={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("is hidden for a PRIVATE market asset", () => {
    const { container } = render(
      <AssetReviewButton
        asset={makeAsset({
          market: {
            code: "PRIVATE",
            name: "Private",
            currency: undefined as never,
          },
        })}
        onShow={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("does not trigger the surrounding click handler", () => {
    const outer = jest.fn()
    render(
      <div onClick={outer}>
        <AssetReviewButton asset={makeAsset()} onShow={jest.fn()} />
      </div>,
    )
    fireEvent.click(screen.getByRole("button", { name: /AI review/ }))
    expect(outer).not.toHaveBeenCalled()
  })
})
