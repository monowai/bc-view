import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PortfolioBreakdownPopup from "../PortfolioBreakdownPopup"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { makeAsset, makePortfolioBreakdown } from "@test-fixtures/beancounter"

jest.mock("@hooks/usePrivacyMode")
const mockedUsePrivacyMode = usePrivacyMode as jest.MockedFunction<
  typeof usePrivacyMode
>

const push = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push }),
}))

const asset = makeAsset({ code: "AAPL", name: "Apple Inc" })

const breakdown = [
  makePortfolioBreakdown({
    portfolioId: "p1",
    portfolioCode: "MAIN",
    portfolioName: "Main Account",
    quantity: 60,
  }),
  makePortfolioBreakdown({
    portfolioId: "p2",
    portfolioCode: "ISA",
    portfolioName: "Stocks ISA",
    quantity: 40,
  }),
]

describe("PortfolioBreakdownPopup", () => {
  beforeEach(() => {
    push.mockReset()
    mockedUsePrivacyMode.mockReturnValue({
      hideValues: false,
      toggleHideValues: jest.fn(),
    })
  })

  it("lists each portfolio with code, name, and quantity", () => {
    render(
      <PortfolioBreakdownPopup
        asset={asset}
        breakdown={breakdown}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("MAIN")).toBeInTheDocument()
    expect(screen.getByText("Main Account")).toBeInTheDocument()
    expect(screen.getByText("ISA")).toBeInTheDocument()
    expect(screen.getByText("Stocks ISA")).toBeInTheDocument()
    expect(screen.getByText("60")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
  })

  it("sorts rows by quantity descending", () => {
    render(
      <PortfolioBreakdownPopup
        asset={asset}
        breakdown={[breakdown[1], breakdown[0]]}
        onClose={jest.fn()}
      />,
    )
    const buttons = screen.getAllByRole("button", {
      name: /Open .* holdings/i,
    })
    expect(buttons[0]).toHaveTextContent("MAIN")
    expect(buttons[1]).toHaveTextContent("ISA")
  })

  it("navigates to /holdings/{code} and closes when a row is clicked", () => {
    const onClose = jest.fn()
    render(
      <PortfolioBreakdownPopup
        asset={asset}
        breakdown={breakdown}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Open MAIN holdings/i }))
    expect(onClose).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/holdings/MAIN")
  })

  it("marks portfolio codes and broker holdings with drilldown-consistent icons", () => {
    const { container } = render(
      <PortfolioBreakdownPopup
        asset={asset}
        breakdown={[
          makePortfolioBreakdown({
            portfolioId: "p1",
            portfolioCode: "DbS",
            portfolioName: "DBS Account",
            quantity: 255,
            held: { DBS: 175, SCB: 80 },
          }),
        ]}
        onClose={jest.fn()}
      />,
    )
    // Portfolio code carries the portfolio icon (fa-building, as in trades)
    expect(container.querySelector("i.fa-building")).toBeInTheDocument()
    // Each broker slice is badged with the broker icon (fa-university)
    expect(container.querySelectorAll("i.fa-university")).toHaveLength(2)
    expect(screen.getByText("DBS")).toBeInTheDocument()
    expect(screen.getByText("175")).toBeInTheDocument()
    expect(screen.getByText("SCB")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()
  })

  it("shows no broker badges when a row has no held map", () => {
    const { container } = render(
      <PortfolioBreakdownPopup
        asset={asset}
        breakdown={breakdown}
        onClose={jest.fn()}
      />,
    )
    expect(container.querySelector("i.fa-university")).not.toBeInTheDocument()
  })

  it("calls onSelect with the row instead of navigating when provided", () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()
    render(
      <PortfolioBreakdownPopup
        breakdown={breakdown}
        title="Trade AAPL — choose portfolio"
        onSelect={onSelect}
        onClose={onClose}
      />,
    )
    expect(
      screen.getByText("Trade AAPL — choose portfolio"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Open MAIN holdings/i }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioId: "p1", portfolioCode: "MAIN" }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
