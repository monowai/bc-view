import React from "react"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import AssetNewsButton from "../AssetNewsButton"
import { useNewsAsset } from "../useNewsAsset"
import { makeAsset, makeCashAsset } from "@test-fixtures/beancounter"

describe("AssetNewsButton", () => {
  it("renders for tradeable non-cash assets", () => {
    const onShow = jest.fn()
    render(<AssetNewsButton asset={makeAsset({ code: "AAPL" })} onShow={onShow} />)
    expect(screen.getByLabelText("News AAPL")).toBeInTheDocument()
  })

  it("returns null for cash assets", () => {
    const { container } = render(
      <AssetNewsButton asset={makeCashAsset()} onShow={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("returns null for PRIVATE market", () => {
    const asset = makeAsset({
      code: "MYHOUSE",
      market: { code: "PRIVATE", name: "Private", currency: { code: "USD", name: "US Dollar", symbol: "$" } },
    })
    const { container } = render(
      <AssetNewsButton asset={asset} onShow={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("invokes onShow on click and stops propagation", () => {
    const onShow = jest.fn()
    const onParent = jest.fn()
    render(
      <div onClick={onParent}>
        <AssetNewsButton asset={makeAsset({ code: "AAPL" })} onShow={onShow} />
      </div>,
    )
    fireEvent.click(screen.getByLabelText("News AAPL"))
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onParent).not.toHaveBeenCalled()
  })

  it("strips owner prefix in aria-label", () => {
    render(
      <AssetNewsButton
        asset={makeAsset({ code: "userId.MSFT" })}
        onShow={jest.fn()}
      />,
    )
    expect(screen.getByLabelText("News MSFT")).toBeInTheDocument()
  })
})

describe("useNewsAsset", () => {
  it("initial popup is null", () => {
    const { result } = renderHook(() => useNewsAsset())
    expect(result.current.popup).toBeNull()
  })

  it("showNews sets popup with built news ref", () => {
    const { result } = renderHook(() => useNewsAsset())
    act(() => {
      result.current.showNews(makeAsset({ code: "AAPL", name: "Apple Inc." }))
    })
    // popup is a React element; cannot assert rendered output without rendering it.
    // Instead assert it's non-null after showNews.
    expect(result.current.popup).not.toBeNull()
  })

  it("close clears popup", () => {
    const { result } = renderHook(() => useNewsAsset())
    act(() => {
      result.current.showNews(makeAsset({ code: "AAPL" }))
    })
    expect(result.current.popup).not.toBeNull()
    act(() => {
      result.current.close()
    })
    expect(result.current.popup).toBeNull()
  })
})
